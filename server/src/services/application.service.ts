import Boom from "boom"
import { isEmailBurner } from "burner-email-providers"
import Joi from "joi"
import type { EnforceDocument } from "mongoose"
import { oleoduc, writeData } from "oleoduc"
import { IApplication, IJob, ILbaCompany, INewApplication, IRecruiter, IUserRecruteur, JOB_STATUS, ZApplication, assertUnreachable } from "shared"
import { ApplicantIntention } from "shared/constants/application"
import { BusinessErrorCodes } from "shared/constants/errorCodes"
import { RECRUITER_STATUS } from "shared/constants/recruteur"
import { prepareMessageForMail, removeUrlsFromText } from "shared/helpers/common"

import { getStaticFilePath } from "@/common/utils/getStaticFilePath"
import { UserForAccessToken } from "@/security/accessTokenService"

import { logger } from "../common/logger"
import { Application, EmailBlacklist, LbaCompany, Recruiter, UserRecruteur } from "../common/model"
import { manageApiError } from "../common/utils/errorManager"
import { sentryCaptureException } from "../common/utils/sentryUtils"
import config from "../config"

import { createCancelJobLink, createProvidedJobLink, generateApplicationReplyToken } from "./appLinks.service"
import { BrevoEventStatus } from "./brevo.service"
import { scan } from "./clamav.service"
import { getOffreAvecInfoMandataire } from "./formulaire.service"
import { buildLbaCompanyAddress } from "./lbacompany.service"
import mailer, { sanitizeForEmail } from "./mailer.service"
import { validateCaller } from "./queryValidator.service"

const MAX_MESSAGES_PAR_OFFRE_PAR_CANDIDAT = 3
const MAX_MESSAGES_PAR_SIRET_PAR_CALLER = 20
const MAX_CANDIDATURES_PAR_CANDIDAT_PAR_JOUR = 100

const publicUrl = config.publicUrl

const imagePath = `${config.publicUrl}/images/emails/`

const images: object = {
  images: {
    logoLba: `${imagePath}logo_LBA.png`,
    logoRF: `${imagePath}logo_rf.png`,
    logoGrimp: `${imagePath}logo_grimp.png`,
    icoInfo: `${imagePath}icone_info.png`,
    icoCandidat: `${imagePath}icone_candidat.png`,
    nspp: `${imagePath}nspp.png`,
    utile: `${imagePath}utile.png`,
    pasUtile: `${imagePath}pasUtile.png`,
    neutre: `${imagePath}neutre.png`,
    recrute: `${imagePath}recrute.png`,
    recrutePas: `${imagePath}recrutePas.png`,
    edit: `${imagePath}icone_edit.png`,
    check: `${imagePath}icone_check.png`,
    enveloppe: `${imagePath}icone_enveloppe.png`,
    bin: `${imagePath}icone_bin.png`,
  },
}

/**
 * @description Get applications by job id
 */
export const getApplicationsByJobId = (job_id: IApplication["job_id"]) => Application.find({ job_id }).lean()

/**
 * @description Get applications count by job id
 */
export const getApplicationCount = (job_id: IApplication["job_id"]) => Application.count({ job_id }).lean()

/**
 * @description Check if an email if blacklisted.
 * @param {string} email - Email
 * @return {Promise<boolean>}
 */
export const isEmailBlacklisted = async (email: string): Promise<boolean> => Boolean(await EmailBlacklist.countDocuments({ email }))

/**
 * @description Add an email address to the blacklist collection.
 * @param {string} email
 * @param {string} blacklistingOrigin
 * @return {Promise<void>}
 */
export const addEmailToBlacklist = async (email: string, blacklistingOrigin: string): Promise<void> => {
  try {
    await new EmailBlacklist({
      email,
      blacklisting_origin: blacklistingOrigin,
    }).save()
  } catch (err) {
    // catching unique address error
    logger.error(`Failed to save email to blacklist (${email}). Reason : ${err}`)
  }
}

/**
 * @description Get an application by message id
 * @param {string} messageId
 * @param {string} email
 * @returns {Promise<IApplication>}
 */
export const findApplicationByMessageId = async ({ messageId, email }: { messageId: string; email: string }) =>
  Application.findOne({ company_email: email, to_company_message_id: messageId })

/**
 * @description Remove an email address form all bonnesboites where it is present
 * @param {string} email
 * @return {Promise<void>}
 */
export const removeEmailFromLbaCompanies = async (email: string) => {
  try {
    oleoduc(
      LbaCompany.find({ email }).cursor(),
      writeData((company) => {
        company.email = ""
        company.save()
      })
    )
  } catch (err) {
    logger.error(`Failed to clean bonnes boîtes emails from hardbounce (${email})`)
    // do nothing
  }
}

/**
 * Send an application email to a company and a confirmation email to the applicant
 */
export const sendApplication = async ({
  newApplication,
  referer,
}: {
  newApplication: INewApplication
  referer: string | undefined
}): Promise<{ error: string } | { result: "ok"; message: "messages sent" }> => {
  if (!validateCaller({ caller: newApplication.caller, referer })) {
    return { error: "missing_caller" }
  } else {
    let validationResult = validatePermanentEmail(newApplication.applicant_email)
    if (validationResult !== "ok") {
      return { error: validationResult }
    }
    try {
      const offreOrError = await validateJob(newApplication)
      if ("error" in offreOrError) {
        return { error: offreOrError.error }
      }

      validationResult = await checkUserApplicationCount(newApplication.applicant_email.toLowerCase(), newApplication)
      if (validationResult !== "ok") {
        return { error: validationResult }
      }

      validationResult = await scanFileContent(newApplication)
      if (validationResult !== "ok") {
        return { error: validationResult }
      }

      const { type: offreType } = offreOrError
      const recruteurEmail = (offreType === "matcha" ? offreOrError.recruiter.email : offreOrError.company.email)?.toLowerCase()
      if (!recruteurEmail) {
        return { error: "email du recruteur manquant" }
      }
      const application = newApplicationToApplicationDocument(newApplication, offreOrError, recruteurEmail)
      const fileContent = newApplication.applicant_file_content

      const { url: urlOfDetail, urlWithoutUtm: urlOfDetailNoUtm } = buildUrlsOfDetail(publicUrl, newApplication)
      const recruiterEmailUrls = await buildRecruiterEmailUrls(application)
      const searched_for_job_label = newApplication.searched_for_job_label || ""

      const buildTopic = (aCompanyType: INewApplication["company_type"], aJobTitle: string) => {
        if (aCompanyType === "matcha") {
          return `Candidature en alternance - ${aJobTitle}`
        } else {
          return `Candidature spontanée en alternance ${searched_for_job_label ? "- " + searched_for_job_label : ""}`
        }
      }

      // Sends acknowledge email to "candidate" and application email to "company"
      const emailCompany = await mailer.sendEmail({
        to: newApplication.company_email && newApplication.secret && newApplication.secret === config.lbaSecret ? newApplication.company_email : application.company_email,
        subject: buildTopic(newApplication.company_type, application.job_title),
        template: getEmailTemplate("mail-candidature"),
        data: {
          ...sanitizeApplicationForEmail(application.toObject()),
          ...images,
          ...recruiterEmailUrls,
          searched_for_job_label: sanitizeForEmail(searched_for_job_label),
          urlOfDetail,
          urlOfDetailNoUtm,
        },
        attachments: [
          {
            filename: application.applicant_attachment_name,
            path: fileContent,
          },
        ],
      })
      const emailCandidat = await mailer.sendEmail({
        to: application.applicant_email,
        subject: `Votre candidature chez ${application.company_name}`,
        template: getEmailTemplate(offreType === "matcha" ? "mail-candidat-matcha" : "mail-candidat"),
        data: { ...sanitizeApplicationForEmail(application.toObject()), ...images, publicUrl, urlOfDetail, urlOfDetailNoUtm },
        attachments: [
          {
            filename: application.applicant_attachment_name,
            path: fileContent,
          },
        ],
      })

      application.to_applicant_message_id = emailCandidat.messageId
      if (emailCompany?.accepted?.length) {
        application.to_company_message_id = emailCompany.messageId
      } else {
        logger.info(`Application email rejected. applicant_email=${application.applicant_email} company_email=${application.company_email}`)
        throw new Error("Application email rejected")
      }

      await application.save()

      return { result: "ok", message: "messages sent" }
    } catch (err) {
      logger.error("Error sending application", err)
      sentryCaptureException(err)
      if (newApplication?.caller) {
        manageApiError({
          error: err,
          api_path: "applicationV1",
          caller: newApplication.caller,
          errorTitle: "error_sending_application",
        })
      }
      return { error: "error_sending_application" }
    }
  }
}

/**
 * Build url to access item detail on LBA ui
 */
const buildUrlsOfDetail = (publicUrl: string, newApplication: INewApplication) => {
  const { company_type, job_id, company_siret } = newApplication
  const urlSearchParams = new URLSearchParams()
  urlSearchParams.append("display", "list")
  urlSearchParams.append("page", "fiche")
  urlSearchParams.append("type", company_type)
  if (company_type === "matcha" && job_id) {
    urlSearchParams.append("itemId", job_id)
  } else if (company_type === "lba") {
    urlSearchParams.append("itemId", company_siret)
  }
  const paramsWithoutUtm = urlSearchParams.toString()
  if (company_type === "matcha") {
    urlSearchParams.append("utm_source", "jecandidate")
    urlSearchParams.append("utm_medium", "email")
    urlSearchParams.append("utm_campaign", "jecandidaterecruteur")
  }
  const params = urlSearchParams.toString()
  return {
    urlWithoutUtm: `${publicUrl}/recherche-apprentissage?${paramsWithoutUtm}`,
    url: `${publicUrl}/recherche-apprentissage?${params}`,
  }
}

const buildUserToken = (application: IApplication, userRecruteur?: IUserRecruteur): UserForAccessToken => {
  const { job_origin, company_siret, company_email } = application
  if (job_origin === "lba") {
    return { type: "lba-company", siret: company_siret, email: company_email }
  } else if (job_origin === "matcha") {
    if (!userRecruteur) {
      throw Boom.internal("un user recruteur était attendu")
    }
    return userRecruteur
  } else {
    throw Boom.internal(`job_origin=${job_origin} non supporté`)
  }
}

const buildReplyLink = (application: IApplication, intention: ApplicantIntention, userRecruteur?: IUserRecruteur) => {
  const applicationId = application._id.toString()
  const searchParams = new URLSearchParams()
  searchParams.append("company_recruitment_intention", intention)
  searchParams.append("id", applicationId)
  searchParams.append("fn", application.applicant_first_name)
  searchParams.append("ln", application.applicant_last_name)
  searchParams.append("utm_source", "jecandidate")
  searchParams.append("utm_medium", "email")
  searchParams.append("utm_campaign", "jecandidaterecruteur")
  const token = generateApplicationReplyToken(buildUserToken(application, userRecruteur), applicationId)
  searchParams.append("token", token)
  return `${config.publicUrl}/formulaire-intention?${searchParams.toString()}`
}

/**
 * Build urls to add in email messages sent to the recruiter
 */
const buildRecruiterEmailUrls = async (application: IApplication) => {
  const utmRecruiterData = "&utm_source=jecandidate&utm_medium=email&utm_campaign=jecandidaterecruteur"

  // get the related recruiters to fetch it's establishment_id
  let userRecruteur: IUserRecruteur | undefined
  if (application.job_id) {
    const recruiter = await Recruiter.findOne({ "jobs._id": application.job_id }).lean()
    if (recruiter) {
      if (recruiter.is_delegated) {
        userRecruteur = await UserRecruteur.findOne({ establishment_siret: recruiter.cfa_delegated_siret }).lean()
      } else {
        userRecruteur = await UserRecruteur.findOne({ establishment_id: recruiter.establishment_id }).lean()
      }
    }
  }

  const urls = {
    meetCandidateUrl: buildReplyLink(application, ApplicantIntention.ENTRETIEN, userRecruteur),
    waitCandidateUrl: buildReplyLink(application, ApplicantIntention.NESAISPAS, userRecruteur),
    refuseCandidateUrl: buildReplyLink(application, ApplicantIntention.REFUS, userRecruteur),
    lbaRecruiterUrl: `${config.publicUrl}/acces-recruteur?${utmRecruiterData}`,
    unsubscribeUrl: `${config.publicUrl}/desinscription?email=${application.company_email}${utmRecruiterData}`,
    lbaUrl: `${config.publicUrl}?${utmRecruiterData}`,
    faqUrl: `${config.publicUrl}/faq?${utmRecruiterData}`,
    jobProvidedUrl: "",
    cancelJobUrl: "",
  }

  if (application.job_id && userRecruteur) {
    urls.jobProvidedUrl = createProvidedJobLink(userRecruteur, application.job_id, utmRecruiterData)
    urls.cancelJobUrl = createCancelJobLink(userRecruteur, application.job_id, utmRecruiterData)
  }

  return urls
}

const offreOrCompanyToCompanyFields = (offreOrCompany: OffreOrLbbCompany): Partial<IApplication> => {
  const { type } = offreOrCompany
  if (type === "lba") {
    const { company } = offreOrCompany
    const { siret, enseigne, naf_label } = company
    const application: Partial<IApplication> = {
      company_siret: siret,
      company_name: enseigne,
      company_naf: naf_label,
      job_title: enseigne,
      company_address: buildLbaCompanyAddress(company),
    }
    return application
  } else if (type === "matcha") {
    const { offre, recruiter } = offreOrCompany
    const { address, is_delegated, establishment_siret, establishment_enseigne, establishment_raison_sociale, naf_label } = recruiter
    const { rome_appellation_label, rome_label } = offre
    const application: Partial<IApplication> = {
      company_siret: establishment_siret,
      company_name: establishment_enseigne || establishment_raison_sociale || "Enseigne inconnue",
      company_naf: naf_label ?? undefined,
      job_title: rome_appellation_label ?? rome_label ?? undefined,
      company_address: is_delegated ? null : address,
      job_id: offre._id.toString(),
    }
    return application
  } else {
    assertUnreachable(type)
  }
}

const cleanApplicantFields = (newApplication: INewApplication): Partial<IApplication> => {
  return {
    applicant_first_name: newApplication.applicant_first_name,
    applicant_last_name: newApplication.applicant_last_name,
    applicant_attachment_name: newApplication.applicant_file_name,
    applicant_email: newApplication.applicant_email.toLowerCase(),
    applicant_message_to_company: prepareMessageForMail(newApplication.message),
    applicant_phone: newApplication.applicant_phone,
    caller: newApplication.caller,
  }
}

/**
 * Initialize application object from query parameters
 */
const newApplicationToApplicationDocument = (newApplication: INewApplication, offreOrCompany: OffreOrLbbCompany, recruteurEmail: string) => {
  const res = new Application({
    ...offreOrCompanyToCompanyFields(offreOrCompany),
    ...cleanApplicantFields(newApplication),
    company_email: recruteurEmail.toLowerCase(),
    job_origin: newApplication.company_type,
  })
  ZApplication.parse(res.toObject())
  return res
}

/**
 * @description Return template file path for given type
 * @param {string} type
 * @return {string}
 */
export const getEmailTemplate = (type = "mail-candidat"): string => {
  return getStaticFilePath(`./templates/${type}.mjml.ejs`)
}

type OffreOrLbbCompany = { type: "lba"; company: ILbaCompany } | { type: "matcha"; offre: IJob; recruiter: IRecruiter }

/**
 * @description checks if job applied to is valid
 */
export const validateJob = async (validable: INewApplication): Promise<OffreOrLbbCompany | { error: string }> => {
  const { company_type, job_id, company_siret } = validable

  if (company_type === "matcha") {
    if (!job_id) {
      return { error: "job_id manquant" }
    }
    const recruiterResult = await getOffreAvecInfoMandataire(job_id)
    if (!recruiterResult) {
      return { error: "offre manquante" }
    }
    const { recruiter, job } = recruiterResult
    if (recruiter.status !== RECRUITER_STATUS.ACTIF || job.job_status !== JOB_STATUS.ACTIVE) {
      return { error: "offre expirée" }
    }
    return { type: "matcha", offre: job, recruiter }
  } else if (company_type === "lba") {
    if (!company_siret) {
      return { error: "company_siret manquant" }
    }
    const lbaCompany = await LbaCompany.findOne({ siret: company_siret })
    if (!lbaCompany) {
      return { error: "société manquante" }
    }
    return { type: "lba", company: lbaCompany }
  } else {
    assertUnreachable(company_type)
  }
}

/**
 * @description checks if attachment is corrupted
 */
const scanFileContent = async (validable: INewApplication): Promise<string> => {
  return (await scan(validable.applicant_file_content)) ? "pièce jointe invalide" : "ok"
}

/**
 * checks if email is not disposable
 */
export const validatePermanentEmail = (email: string): string => {
  if (isEmailBurner(email)) {
    return "email temporaire non autorisé"
  }
  return "ok"
}

/**
 * @description checks if email's owner has not sent more than allowed count of applications per day
 */
const checkUserApplicationCount = async (applicantEmail: string, application: INewApplication): Promise<string> => {
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const end = new Date()
  end.setHours(23, 59, 59, 999)

  const { company_type: companyType, company_siret, job_id, caller } = application

  let appCount = await Application.countDocuments({
    applicant_email: applicantEmail.toLowerCase(),
    created_at: { $gte: start, $lt: end },
  })

  if (appCount > MAX_CANDIDATURES_PAR_CANDIDAT_PAR_JOUR) {
    return BusinessErrorCodes.TOO_MANY_APPLICATIONS_PER_DAY
  }

  if (companyType === "lba") {
    if (!company_siret) {
      throw new Error("expected a siret")
    }
    appCount = await Application.countDocuments({
      applicant_email: applicantEmail.toLowerCase(),
      company_siret,
    })
    if (appCount >= MAX_MESSAGES_PAR_OFFRE_PAR_CANDIDAT) {
      return BusinessErrorCodes.TOO_MANY_APPLICATIONS_PER_OFFER
    }
  } else if (companyType === "matcha") {
    if (!job_id) {
      throw new Error("expected a job id")
    }
    appCount = await Application.countDocuments({
      applicant_email: applicantEmail.toLowerCase(),
      job_id,
    })
    if (appCount >= MAX_MESSAGES_PAR_OFFRE_PAR_CANDIDAT) {
      return BusinessErrorCodes.TOO_MANY_APPLICATIONS_PER_OFFER
    }
  } else {
    assertUnreachable(companyType)
  }

  if (caller) {
    appCount = await Application.countDocuments({
      caller: caller.toLowerCase(),
      company_siret,
      created_at: { $gte: start, $lt: end },
    })
    if (appCount >= MAX_MESSAGES_PAR_SIRET_PAR_CALLER) {
      return BusinessErrorCodes.TOO_MANY_APPLICATIONS_PER_SIRET
    }
  }

  return "ok"
}

interface IApplicationFeedback {
  id: string
  iv: string
  avis: string
  comment: string
  intention: string
}

/**
 * @description checks application feedback comment parameters
 * @param {Partial<IApplicationFeedback>} validable
 * @return {Promise<string>}
 */
export const validateFeedbackApplicationComment = async (validable: Partial<IApplicationFeedback>): Promise<string> => {
  const schema = Joi.object({
    id: Joi.string().required(),
    iv: Joi.string().required(),
    comment: Joi.string().required(),
    avis: Joi.optional(),
    intention: Joi.optional(),
  })
  await schema.validateAsync(validable)

  return "ok"
}

/**
 * @description sends notification email to applicant
 */
export const sendMailToApplicant = async ({
  application,
  email,
  phone,
  company_recruitment_intention,
  company_feedback,
}: {
  application: IApplication
  email: string | null
  phone: string | null
  company_recruitment_intention: string
  company_feedback: string
}): Promise<void> => {
  switch (company_recruitment_intention) {
    case ApplicantIntention.ENTRETIEN: {
      mailer.sendEmail({
        to: application.applicant_email,
        subject: `Réponse positive de ${application.company_name}`,
        template: getEmailTemplate("mail-candidat-entretien"),
        data: { ...sanitizeApplicationForEmail(application), ...images, email, phone: sanitizeForEmail(removeUrlsFromText(phone)), comment: sanitizeForEmail(company_feedback) },
      })
      break
    }
    case ApplicantIntention.NESAISPAS: {
      mailer.sendEmail({
        to: application.applicant_email,
        subject: `Réponse de ${application.company_name}`,
        template: getEmailTemplate("mail-candidat-nsp"),
        data: { ...sanitizeApplicationForEmail(application), ...images, email, phone: sanitizeForEmail(removeUrlsFromText(phone)), comment: sanitizeForEmail(company_feedback) },
      })
      break
    }
    case ApplicantIntention.REFUS: {
      mailer.sendEmail({
        to: application.applicant_email,
        subject: `Réponse négative de ${application.company_name}`,
        template: getEmailTemplate("mail-candidat-refus"),
        data: { ...sanitizeApplicationForEmail(application), ...images, comment: sanitizeForEmail(company_feedback) },
      })
      break
    }
    default:
      break
  }
}

/**
 * @description updates application and triggers action from email webhook
 */
export const updateApplicationStatusFromHardbounce = async ({ payload, application }: { payload: any; application: IApplication }): Promise<void> => {
  /* Format payload cf. https://developers.brevo.com/docs/transactional-webhooks
  https://developers.brevo.com/docs/marketing-webhooks */

  const { subject, email } = payload

  if (!subject.startsWith("Candidature en alternance") && !subject.startsWith("Candidature spontanée")) {
    // les messages qui ne sont pas de candidature vers une entreprise sont ignorés
    return
  }

  await addEmailToBlacklist(email, application.job_origin ?? "unknown")

  if (application.job_origin === "lba") {
    await removeEmailFromLbaCompanies(email)
  } else if (application.job_origin === "matcha") {
    await warnMatchaTeamAboutBouncedEmail({ application })
  }

  await notifyHardbounceToApplicant({ application })
}

/**
 * sends email notification to applicant if it's application hardbounced
 */
const notifyHardbounceToApplicant = async ({ application }: { application: EnforceDocument<IApplication, any> }): Promise<void> => {
  await mailer.sendEmail({
    to: application.applicant_email,
    subject: `Votre candidature n'a pas pu être envoyée à ${application.company_name}`,
    template: getEmailTemplate("mail-candidat-hardbounce"),
    data: { ...sanitizeApplicationForEmail(application.toObject()), ...images },
  })
}

/**
 * sends email notification to applicant if it's application hardbounced
 */
const warnMatchaTeamAboutBouncedEmail = async ({ application }: { application: EnforceDocument<IApplication, any> }): Promise<void> => {
  await mailer.sendEmail({
    to: config.transactionalEmail,
    subject: `Votre candidature n'a pas pu être envoyée à ${application.company_name}`,
    template: getEmailTemplate("mail-matcha-hardbounce"),
    data: { ...sanitizeApplicationForEmail(application.toObject()), ...images },
  })
}

export interface IApplicationCount {
  _id: string
  count: number
}

/**
 * @description retourne le nombre de candidatures enregistrées par identifiant d'offres lba fournis
 * @param {IJobs["_id"][]} job_ids
 * @returns {Promise<IApplicationCount[]>} token data
 */
export const getApplicationByJobCount = async (job_ids: IApplication["job_id"][]): Promise<IApplicationCount[]> => {
  const applicationCountByJob: IApplicationCount[] = await Application.aggregate([
    {
      $match: {
        job_id: { $in: job_ids },
      },
    },
    {
      $group: {
        _id: "$job_id",
        count: { $sum: 1 },
      },
    },
  ])

  return applicationCountByJob
}

/**
 * @description retourne le nombre de candidatures enregistrées par siret de société fournis
 * @param {ILbaCompany["siret"][]} sirets
 * @returns {Promise<IApplicationCount[]>} token data
 */
export const getApplicationByCompanyCount = async (sirets: ILbaCompany["siret"][]): Promise<IApplicationCount[]> => {
  const applicationCountByCompany: IApplicationCount[] = await Application.aggregate([
    {
      $match: {
        company_siret: { $in: sirets },
      },
    },
    {
      $group: {
        _id: "$company_siret",
        count: { $sum: 1 },
      },
    },
  ])

  return applicationCountByCompany
}

/**
 *  met à jour une candidature si l'événement reçu correspond à une hardbounce
 */
export const processApplicationWebhookEvent = async (payload) => {
  const { event, email } = payload
  const messageId = payload["message-id"]

  // application
  if (event === BrevoEventStatus.HARD_BOUNCE) {
    const application = await findApplicationByMessageId({
      messageId,
      email,
    })

    if (application) {
      await updateApplicationStatusFromHardbounce({ payload, application })
      return false
    }
  }
  return true
}

/**
 *  réagit à un hardbounce non lié à aux autres processeurs de webhook email
 */
export const processHardBounceWebhookEvent = async (payload) => {
  const { event, email } = payload

  if (event === BrevoEventStatus.HARD_BOUNCE) {
    await Promise.all([addEmailToBlacklist(email, "campaign"), removeEmailFromLbaCompanies(email)])
  }
}

const sanitizeApplicationForEmail = (application: IApplication) => {
  const {
    applicant_email,
    applicant_first_name,
    applicant_last_name,
    applicant_phone,
    applicant_attachment_name,
    applicant_message_to_company,
    company_recruitment_intention,
    company_feedback,
    company_feedback_date,
    company_siret,
    company_email,
    company_name,
    company_naf,
    company_address,
    job_origin,
    job_title,
    job_id,
    caller,
    created_at,
    last_update_at,
  } = application
  return {
    applicant_email: sanitizeForEmail(applicant_email),
    applicant_first_name: sanitizeForEmail(applicant_first_name),
    applicant_last_name: sanitizeForEmail(applicant_last_name),
    applicant_phone: sanitizeForEmail(applicant_phone),
    applicant_attachment_name: sanitizeForEmail(applicant_attachment_name),
    applicant_message_to_company: sanitizeForEmail(applicant_message_to_company),
    company_recruitment_intention: sanitizeForEmail(company_recruitment_intention),
    company_feedback: sanitizeForEmail(company_feedback),
    company_feedback_date: company_feedback_date,
    company_siret: company_siret,
    company_email: sanitizeForEmail(company_email),
    company_name: company_name,
    company_naf: company_naf,
    company_address: company_address,
    job_origin: job_origin,
    job_title: sanitizeForEmail(job_title),
    job_id: job_id,
    caller: sanitizeForEmail(caller),
    created_at: created_at,
    last_update_at: last_update_at,
  }
}
