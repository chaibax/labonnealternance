import { internal } from "@hapi/boom"
import { useMongo } from "@tests/utils/mongo.test.utils"
import { ObjectId } from "mongodb"
import nock from "nock"
import { NIVEAUX_POUR_LBA, NIVEAUX_POUR_OFFRES_PE, RECRUITER_STATUS } from "shared/constants"
import { generateCfaFixture } from "shared/fixtures/cfa.fixture"
import { generateJobsPartnersOfferPrivate } from "shared/fixtures/jobPartners.fixture"
import { generateRecruiterFixture } from "shared/fixtures/recruiter.fixture"
import { generateLbaConpanyFixture } from "shared/fixtures/recruteurLba.fixture"
import { parisFixture, clichyFixture, marseilleFixture, levalloisFixture, generateReferentielCommuneFixtures } from "shared/fixtures/referentiel/commune.fixture"
import { generateReferentielRome } from "shared/fixtures/rome.fixture"
import { generateUserWithAccountFixture } from "shared/fixtures/userWithAccount.fixture"
import { ILbaCompany, IRecruiter, IReferentielRome, JOB_STATUS } from "shared/models"
import { IJobsPartnersOfferPrivate, IJobsPartnersWritableApi, INiveauDiplomeEuropeen } from "shared/models/jobsPartners.model"
import { beforeEach, beforeAll, afterEach, describe, expect, it, vi } from "vitest"

import { getEtablissementFromGouvSafe } from "@/common/apis/apiEntreprise/apiEntreprise.client"
import { apiEntrepriseEtablissementFixture } from "@/common/apis/apiEntreprise/apiEntreprise.client.fixture"
import { getRomeoPredictions, searchForFtJobs } from "@/common/apis/franceTravail/franceTravail.client"
import { franceTravailRomeoFixture, generateFtJobFixture } from "@/common/apis/franceTravail/franceTravail.client.fixture"
import { getDbCollection } from "@/common/utils/mongodbUtils"
import { IApiApprentissageTokenData } from "@/security/accessApiApprentissageService"
import { certificationFixtures } from "@/services/external/api-alternance/certification.fixture"

import { FTJob } from "../../ftjob.service.types"

import { createJobOffer, findJobsOpportunities, updateJobOffer } from "./jobOpportunity.service"
import { JobOpportunityRequestContext } from "./JobOpportunityRequestContext"

useMongo()

vi.mock("@/common/apis/franceTravail/franceTravail.client")
vi.mock("@/common/apis/apiEntreprise/apiEntreprise.client")

beforeAll(async () => {
  nock.disableNetConnect()

  return () => {
    nock.enableNetConnect()
  }
})

afterEach(() => {
  nock.cleanAll()
})

describe("findJobsOpportunities", () => {
  const recruiters: ILbaCompany[] = [
    generateLbaConpanyFixture({
      siret: "11000001500013",
      raison_sociale: "ASSEMBLEE NATIONALE",
      enseigne: "ASSEMBLEE NATIONALE - La vraie",
      rome_codes: ["M1602"],
      geopoint: parisFixture.centre,
      insee_city_code: parisFixture.code,
      phone: "0100000000",
      last_update_at: new Date("2021-01-01"),
    }),
    generateLbaConpanyFixture({
      siret: "77555848900073",
      raison_sociale: "GRAND PORT MARITIME DE MARSEILLE (GPMM)",
      rome_codes: ["M1602", "D1212"],
      geopoint: marseilleFixture.centre,
      insee_city_code: marseilleFixture.code,
      phone: "0200000000",
      last_update_at: new Date("2022-01-01"),
    }),
    generateLbaConpanyFixture({
      siret: "52951974600034",
      raison_sociale: "SOCIETE PARISIENNE DE LA PISCINE PONTOISE (S3P)",
      enseigne: "SOCIETE PARISIENNE DE LA PISCINE PONTOISE (S3P)",
      rome_codes: ["D1211"],
      geopoint: levalloisFixture.centre,
      insee_city_code: levalloisFixture.code,
      phone: "0100000001",
      last_update_at: new Date("2023-01-01"),
    }),
  ]

  const lbaJobs: IRecruiter[] = [
    generateRecruiterFixture({
      establishment_siret: "11000001500013",
      establishment_raison_sociale: "ASSEMBLEE NATIONALE",
      geopoint: parisFixture.centre,
      status: RECRUITER_STATUS.ACTIF,
      jobs: [
        {
          rome_code: ["M1602"],
          is_multi_published: true,
          job_status: JOB_STATUS.ACTIVE,
          job_level_label: NIVEAUX_POUR_LBA.INDIFFERENT,
          job_creation_date: new Date("2021-01-01"),
        },
      ],
      address_detail: {
        code_insee_localite: parisFixture.code,
      },
      phone: "0300000000",
    }),
    generateRecruiterFixture({
      establishment_siret: "11000001500013",
      establishment_raison_sociale: "ASSEMBLEE NATIONALE",
      geopoint: marseilleFixture.centre,
      status: RECRUITER_STATUS.ACTIF,
      jobs: [
        {
          rome_code: ["M1602", "D1212"],
          is_multi_published: true,
          job_status: JOB_STATUS.ACTIVE,
          job_level_label: NIVEAUX_POUR_LBA.INDIFFERENT,
          job_creation_date: new Date("2022-01-01"),
        },
      ],
      address_detail: {
        code_insee_localite: marseilleFixture.code,
      },
      phone: "0400000000",
    }),
    generateRecruiterFixture({
      establishment_siret: "20003277900015",
      establishment_raison_sociale: "PARIS MUSEES",
      geopoint: levalloisFixture.centre,
      status: RECRUITER_STATUS.ACTIF,
      jobs: [
        {
          rome_code: ["D1209"],
          is_multi_published: true,
          job_status: JOB_STATUS.ACTIVE,
          job_level_label: NIVEAUX_POUR_LBA.INDIFFERENT,
          job_creation_date: new Date("2023-01-01"),
        },
      ],
      address_detail: {
        code_insee_localite: levalloisFixture.code,
      },
      phone: "0400000001",
    }),
  ]
  const partnerJobs: IJobsPartnersOfferPrivate[] = [
    generateJobsPartnersOfferPrivate({
      offer_rome_code: ["M1602"],
      workplace_geopoint: parisFixture.centre,
      offer_creation: new Date("2021-01-01"),
    }),
    generateJobsPartnersOfferPrivate({
      offer_rome_code: ["M1602", "D1214"],
      workplace_geopoint: marseilleFixture.centre,
      offer_creation: new Date("2022-01-01"),
    }),
    generateJobsPartnersOfferPrivate({
      offer_rome_code: ["D1212"],
      workplace_geopoint: levalloisFixture.centre,
      offer_creation: new Date("2023-01-01"),
    }),
  ]
  const ftJobs: FTJob[] = [
    generateFtJobFixture({
      id: "1",
      romeCode: "M1602",
    }),
  ]
  const romes: IReferentielRome[] = [
    generateReferentielRome({
      rome: {
        code_rome: "M1602",
        intitule: "Opérations administratives",
        code_ogr: "475",
      },
    }),
    ...certificationFixtures["RNCP37098-46T31203"].domaines.rome.rncp.map(({ code, intitule }) => generateReferentielRome({ rome: { code_rome: code, intitule, code_ogr: "" } })),
  ]

  beforeEach(async () => {
    await getDbCollection("recruteurslba").insertMany(recruiters)
    await getDbCollection("recruiters").insertMany(lbaJobs)
    await getDbCollection("jobs_partners").insertMany(partnerJobs)
    await getDbCollection("referentielromes").insertMany(romes)
    await getDbCollection("referentiel.communes").insertMany(generateReferentielCommuneFixtures([parisFixture, clichyFixture, levalloisFixture, marseilleFixture]))
  })

  it("should execute query", async () => {
    vi.mocked(searchForFtJobs).mockResolvedValue({ resultats: ftJobs })

    const results = await findJobsOpportunities(
      {
        longitude: parisFixture.centre.coordinates[0],
        latitude: parisFixture.centre.coordinates[1],
        radius: 30,
        romes: ["M1602"],
        rncp: null,
      },
      new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
    )

    expect(results).toEqual({
      jobs: [
        expect.objectContaining({
          _id: lbaJobs[0].jobs[0]._id.toString(),
          workplace_geopoint: lbaJobs[0].geopoint,
        }),
        expect.objectContaining({
          _id: null,
          partner_job_id: ftJobs[0].id,
          partner: "France Travail",
        }),
        expect.objectContaining({
          _id: partnerJobs[0]._id,
          workplace_geopoint: partnerJobs[0].workplace_geopoint,
        }),
      ],
      recruiters: [
        expect.objectContaining({
          _id: recruiters[0]._id,
          workplace_geopoint: recruiters[0].geopoint,
          workplace_name: recruiters[0].enseigne,
        }),
      ],
      warnings: [],
    })

    expect(searchForFtJobs).toHaveBeenCalledTimes(1)
    expect(searchForFtJobs).toHaveBeenNthCalledWith(
      1,
      {
        codeROME: "M1602",
        commune: "75101", // Special case for paris
        sort: 2,
        natureContrat: "E2,FS",
        range: "0-149",
        distance: 30,
      },
      { throwOnError: true }
    )

    expect(
      results.jobs.map(({ _id, apply_url, ...j }) => {
        return j
      })
    ).toMatchSnapshot()
    expect(
      results.recruiters.map(({ _id, ...j }) => {
        return j
      })
    ).toMatchSnapshot()
  })

  it("should support query without rncp or rome filter", async () => {
    vi.mocked(searchForFtJobs).mockResolvedValue({ resultats: ftJobs })

    const results = await findJobsOpportunities(
      {
        longitude: parisFixture.centre.coordinates[0],
        latitude: parisFixture.centre.coordinates[1],
        radius: 30,
        romes: null,
        rncp: null,
      },
      new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
    )

    expect(results).toEqual({
      jobs: [
        expect.objectContaining({
          _id: lbaJobs[0].jobs[0]._id.toString(),
          workplace_geopoint: lbaJobs[0].geopoint,
        }),
        expect.objectContaining({
          _id: lbaJobs[2].jobs[0]._id.toString(),
          workplace_geopoint: lbaJobs[2].geopoint,
        }),
        expect.objectContaining({
          _id: null,
          partner_job_id: ftJobs[0].id,
          partner: "France Travail",
        }),
        expect.objectContaining({
          _id: partnerJobs[0]._id,
          workplace_geopoint: partnerJobs[0].workplace_geopoint,
        }),
        expect.objectContaining({
          _id: partnerJobs[2]._id,
          workplace_geopoint: partnerJobs[2].workplace_geopoint,
        }),
      ],
      recruiters: [
        expect.objectContaining({
          _id: recruiters[0]._id,
          workplace_geopoint: recruiters[0].geopoint,
          workplace_name: recruiters[0].enseigne,
        }),
        expect.objectContaining({
          _id: recruiters[2]._id,
          workplace_geopoint: recruiters[2].geopoint,
          workplace_name: recruiters[2].enseigne,
        }),
      ],
      warnings: [],
    })

    expect(searchForFtJobs).toHaveBeenCalledTimes(1)
    expect(searchForFtJobs).toHaveBeenNthCalledWith(
      1,
      {
        commune: "75101", // Special case for paris
        sort: 2,
        natureContrat: "E2,FS",
        range: "0-149",
        distance: 30,
      },
      { throwOnError: true }
    )
  })

  it("should support query without geo filter", async () => {
    vi.mocked(searchForFtJobs).mockResolvedValue({ resultats: ftJobs })

    const results = await findJobsOpportunities(
      {
        longitude: null,
        latitude: null,
        radius: 30,
        romes: ["M1602"],
        rncp: null,
      },
      new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
    )

    // Order is most recent first
    expect(results).toEqual({
      jobs: [
        expect.objectContaining({
          _id: lbaJobs[1].jobs[0]._id.toString(),
        }),
        expect.objectContaining({
          _id: lbaJobs[0].jobs[0]._id.toString(),
        }),
        expect.objectContaining({
          _id: null,
          partner_job_id: ftJobs[0].id,
          partner: "France Travail",
        }),
        expect.objectContaining({
          _id: partnerJobs[1]._id,
        }),
        expect.objectContaining({
          _id: partnerJobs[0]._id,
        }),
      ],
      recruiters: [
        expect.objectContaining({
          _id: recruiters[1]._id,
          workplace_name: recruiters[1].enseigne,
        }),
        expect.objectContaining({
          _id: recruiters[0]._id,
          workplace_name: recruiters[0].enseigne,
        }),
      ],
      warnings: [],
    })
    expect(searchForFtJobs).toHaveBeenCalledTimes(1)
    expect(searchForFtJobs).toHaveBeenNthCalledWith(
      1,
      {
        sort: 2,
        natureContrat: "E2,FS",
        range: "0-149",
        codeROME: "M1602",
      },
      { throwOnError: true }
    )
  })

  describe("searching by rncp code", async () => {
    it("should return jobs corresponding to the romes codes associated with the requested rncp code", async () => {
      vi.mocked(searchForFtJobs).mockResolvedValue({ resultats: [] })

      const scopeApiAlternance = nock("https://api.apprentissage.beta.gouv.fr:443")
        .get("/api/certification/v1")
        .query({ "identifiant.rncp": certificationFixtures["RNCP37098-46T31203"].identifiant.rncp })
        .matchHeader("Authorization", "Bearer api-apprentissage-api-key")
        .reply(200, [certificationFixtures["RNCP37098-46T31203"]])

      const results = await findJobsOpportunities(
        {
          longitude: parisFixture.centre.coordinates[0],
          latitude: parisFixture.centre.coordinates[1],
          radius: 30,
          rncp: "RNCP37098",
          romes: null,
        },
        new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
      )

      expect(results).toEqual({
        jobs: [
          expect.objectContaining({
            _id: lbaJobs[2].jobs[0]._id.toString(),
            workplace_geopoint: lbaJobs[2].geopoint,
          }),
          expect.objectContaining({
            _id: partnerJobs[2]._id,
            workplace_geopoint: partnerJobs[2].workplace_geopoint,
          }),
        ],
        recruiters: [
          expect.objectContaining({
            _id: recruiters[2]._id,
            workplace_geopoint: recruiters[2].geopoint,
            workplace_name: recruiters[2].enseigne,
          }),
        ],
        warnings: [],
      })
      expect(scopeApiAlternance.isDone()).toBeTruthy()
      expect(searchForFtJobs).toHaveBeenCalledTimes(1)
      expect(searchForFtJobs).toHaveBeenNthCalledWith(
        1,
        {
          // Code ROME correspondant au code RNCP
          codeROME: "D1210,D1212,D1209,D1214,D1211",
          commune: "75101", // Special case for paris
          sort: 2,
          natureContrat: "E2,FS",
          range: "0-149",
          distance: 30,
        },
        { throwOnError: true }
      )
    })

    it("should error internal when API Alternance request fail", async () => {
      await expect(
        findJobsOpportunities(
          {
            longitude: parisFixture.centre.coordinates[0],
            latitude: parisFixture.centre.coordinates[1],
            radius: 30,
            rncp: "RNCP37098",
            romes: null,
          },
          new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
        )
      ).rejects.toThrowError(internal("Erreur lors de la récupération des informations de certification"))
    })

    it("should throw bad request when rncp code is not found", async () => {
      const scopeApiAlternance = nock("https://api.apprentissage.beta.gouv.fr:443")
        .get("/api/certification/v1")
        .query({ "identifiant.rncp": "RNCP30000" })
        .matchHeader("Authorization", "Bearer api-apprentissage-api-key")
        .reply(200, [])

      await expect(
        findJobsOpportunities(
          {
            longitude: parisFixture.centre.coordinates[0],
            latitude: parisFixture.centre.coordinates[1],
            radius: 30,
            rncp: "RNCP30000",
            romes: null,
          },
          new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
        )
      ).rejects.toThrowError(internal("Cannot find an active Certification for the given RNCP"))

      expect(scopeApiAlternance.isDone()).toBeTruthy()
    })

    it("should throw bad request when rncp is not active and no active replacement", async () => {
      const scopeApiAlternance = nock("https://api.apprentissage.beta.gouv.fr:443")
        .get("/api/certification/v1")
        .query({ "identifiant.rncp": "RNCP9852" })
        .matchHeader("Authorization", "Bearer api-apprentissage-api-key")
        .reply(200, [certificationFixtures["RNCP9852-26X32304"]])

      await expect(
        findJobsOpportunities(
          {
            longitude: parisFixture.centre.coordinates[0],
            latitude: parisFixture.centre.coordinates[1],
            radius: 30,
            rncp: "RNCP9852",
            romes: null,
          },
          new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
        )
      ).rejects.toThrowError(internal("Cannot find an active Certification for the given RNCP"))

      expect(scopeApiAlternance.isDone()).toBeTruthy()
    })

    it("should resolve RNCP continuity", async () => {
      vi.mocked(searchForFtJobs).mockResolvedValue({ resultats: [] })

      const scopeApiAlternance = nock("https://api.apprentissage.beta.gouv.fr:443")
        .get("/api/certification/v1")
        .query({ "identifiant.rncp": "RNCP37098" })
        .matchHeader("Authorization", "Bearer api-apprentissage-api-key")
        .reply(200, [certificationFixtures["RNCP37098-46T31203"]])

      scopeApiAlternance
        .get("/api/certification/v1")
        .query({ "identifiant.rncp": "RNCP13620" })
        .matchHeader("Authorization", "Bearer api-apprentissage-api-key")
        .reply(200, [certificationFixtures["RNCP13620-46T31203"]])

      const results = await findJobsOpportunities(
        {
          longitude: parisFixture.centre.coordinates[0],
          latitude: parisFixture.centre.coordinates[1],
          radius: 30,
          rncp: "RNCP13620",
          romes: null,
        },
        new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
      )

      expect(results).toEqual({
        jobs: [
          expect.objectContaining({
            _id: lbaJobs[2].jobs[0]._id.toString(),
            workplace_geopoint: lbaJobs[2].geopoint,
          }),
          expect.objectContaining({
            _id: partnerJobs[2]._id,
            workplace_geopoint: partnerJobs[2].workplace_geopoint,
          }),
        ],
        recruiters: [
          expect.objectContaining({
            _id: recruiters[2]._id,
            workplace_geopoint: recruiters[2].geopoint,
            workplace_name: recruiters[2].enseigne,
          }),
        ],
        warnings: [],
      })
      expect(searchForFtJobs).toHaveBeenCalledTimes(1)
      expect(searchForFtJobs).toHaveBeenCalledWith(
        {
          // Code ROME correspondant au code RNCP
          codeROME: "D1210,D1212,D1209,D1214,D1211",
          commune: "75101", // Special case for paris
          sort: 2,
          natureContrat: "E2,FS",
          range: "0-149",
          distance: 30,
        },
        { throwOnError: true }
      )
      expect(scopeApiAlternance.isDone()).toBeTruthy()
    })
  })

  it("should RNCP & ROME filter appliy as OR condition", async () => {
    vi.mocked(searchForFtJobs).mockResolvedValue({ resultats: ftJobs })

    const scopeApiAlternance = nock("https://api.apprentissage.beta.gouv.fr:443")
      .get("/api/certification/v1")
      .query({ "identifiant.rncp": certificationFixtures["RNCP37098-46T31203"].identifiant.rncp })
      .matchHeader("Authorization", "Bearer api-apprentissage-api-key")
      .reply(200, [certificationFixtures["RNCP37098-46T31203"]])

    const results = await findJobsOpportunities(
      {
        longitude: parisFixture.centre.coordinates[0],
        latitude: parisFixture.centre.coordinates[1],
        radius: 30,
        romes: ["M1602"],
        rncp: "RNCP37098",
      },
      new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
    )

    expect(results).toEqual({
      jobs: [
        expect.objectContaining({
          _id: lbaJobs[0].jobs[0]._id.toString(),
          workplace_geopoint: lbaJobs[0].geopoint,
        }),
        expect.objectContaining({
          _id: lbaJobs[2].jobs[0]._id.toString(),
          workplace_geopoint: lbaJobs[2].geopoint,
        }),
        expect.objectContaining({
          _id: null,
          partner_job_id: ftJobs[0].id,
          partner: "France Travail",
        }),
        expect.objectContaining({
          _id: partnerJobs[0]._id,
          workplace_geopoint: partnerJobs[0].workplace_geopoint,
        }),
        expect.objectContaining({
          _id: partnerJobs[2]._id,
          workplace_geopoint: partnerJobs[2].workplace_geopoint,
        }),
      ],
      recruiters: [
        expect.objectContaining({
          _id: recruiters[0]._id,
          workplace_geopoint: recruiters[0].geopoint,
          workplace_name: recruiters[0].enseigne,
        }),
        expect.objectContaining({
          _id: recruiters[2]._id,
          workplace_geopoint: recruiters[2].geopoint,
          workplace_name: recruiters[2].enseigne,
        }),
      ],
      warnings: [],
    })

    expect(searchForFtJobs).toHaveBeenCalledTimes(1)
    expect(searchForFtJobs).toHaveBeenCalledWith(
      {
        codeROME: "M1602,D1210,D1212,D1209,D1214,D1211",
        commune: "75101", // Special case for paris
        sort: 2,
        natureContrat: "E2,FS",
        range: "0-149",
        distance: 30,
      },
      { throwOnError: true }
    )
    expect(scopeApiAlternance.isDone()).toBeTruthy()
  })

  describe("lba company", () => {
    beforeEach(async () => {
      nock("https://api.francetravail.io")
        .get("/partenaire/offresdemploi/v2/offres/search")
        .query(() => true)
        .reply(200, { resultats: [] })
    })

    it("should limit companies to 150", async () => {
      const extraLbaCompanies: ILbaCompany[] = Array.from({ length: 200 }, () =>
        generateLbaConpanyFixture({
          geopoint: parisFixture.centre,
          rome_codes: ["M1602"],
        })
      )
      await getDbCollection("recruteurslba").insertMany(extraLbaCompanies)

      const results = await findJobsOpportunities(
        {
          longitude: parisFixture.centre.coordinates[0],
          latitude: parisFixture.centre.coordinates[1],
          radius: 30,
          romes: ["M1602"],
          rncp: null,
        },
        new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
      )

      expect(results.recruiters).toHaveLength(150)
    })

    it("should exclude companies not within the radius", async () => {
      const results1 = await findJobsOpportunities(
        {
          longitude: clichyFixture.centre.coordinates[0],
          latitude: clichyFixture.centre.coordinates[1],
          radius: 30,
          romes: ["M1602"],
          rncp: null,
        },
        new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
      )

      expect(results1.recruiters).toHaveLength(1)

      const results2 = await findJobsOpportunities(
        {
          longitude: clichyFixture.centre.coordinates[0],
          latitude: clichyFixture.centre.coordinates[1],
          radius: 2,
          romes: ["M1602"],
          rncp: null,
        },
        new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
      )

      expect(results2.recruiters).toHaveLength(0)
    })
  })

  describe("labonnealternance jobs", () => {
    beforeEach(async () => {
      vi.mocked(searchForFtJobs).mockResolvedValue({ resultats: [] })

      await getDbCollection("jobs_partners").deleteMany({})
    })

    it("should exclude non active recruiters", async () => {
      const extraRecruiters: IRecruiter[] = []

      for (const status of [RECRUITER_STATUS.ARCHIVE, RECRUITER_STATUS.EN_ATTENTE_VALIDATION]) {
        extraRecruiters.push(
          generateRecruiterFixture({
            establishment_siret: "11000001500013",
            establishment_raison_sociale: "ASSEMBLEE NATIONALE",
            geopoint: parisFixture.centre,
            status,
            jobs: [
              {
                rome_code: ["M1602"],
                is_multi_published: true,
                job_status: JOB_STATUS.ACTIVE,
                job_level_label: NIVEAUX_POUR_LBA.INDIFFERENT,
              },
            ],
            address_detail: {
              code_insee_localite: parisFixture.code,
            },
          })
        )
      }

      await getDbCollection("recruiters").insertMany(extraRecruiters)

      const results = await findJobsOpportunities(
        {
          longitude: parisFixture.centre.coordinates[0],
          latitude: parisFixture.centre.coordinates[1],
          radius: 30,
          romes: ["M1602"],
          rncp: null,
        },
        new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
      )

      expect(results.jobs).toHaveLength(1)
    })

    it("should exclude non active jobs", async () => {
      await getDbCollection("recruiters").insertOne(
        generateRecruiterFixture({
          establishment_siret: "11000001500013",
          establishment_raison_sociale: "ASSEMBLEE NATIONALE",
          geopoint: parisFixture.centre,
          status: RECRUITER_STATUS.ACTIF,
          jobs: [
            {
              rome_code: ["M1602"],
              is_multi_published: true,
              job_status: JOB_STATUS.ANNULEE,
              job_level_label: NIVEAUX_POUR_LBA.INDIFFERENT,
            },
            {
              rome_code: ["M1602"],
              is_multi_published: true,
              job_status: JOB_STATUS.EN_ATTENTE,
              job_level_label: NIVEAUX_POUR_LBA.INDIFFERENT,
            },
            {
              rome_code: ["M1602"],
              is_multi_published: true,
              job_status: JOB_STATUS.POURVUE,
              job_level_label: NIVEAUX_POUR_LBA.INDIFFERENT,
            },
            {
              rome_code: ["M1602"],
              is_multi_published: true,
              job_status: JOB_STATUS.ACTIVE,
              job_level_label: NIVEAUX_POUR_LBA.INDIFFERENT,
            },
          ],
          address_detail: {
            code_insee_localite: parisFixture.code,
          },
        })
      )

      const results = await findJobsOpportunities(
        {
          longitude: parisFixture.centre.coordinates[0],
          latitude: parisFixture.centre.coordinates[1],
          radius: 30,
          romes: ["M1602"],
          rncp: null,
        },
        new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
      )

      expect(results.jobs).toHaveLength(2)
    })

    describe("when filtered by diploma", () => {
      it("should return jobs with requested diploma and unknown ones only", async () => {
        await getDbCollection("recruiters").insertOne(
          generateRecruiterFixture({
            establishment_siret: "11000001500013",
            geopoint: parisFixture.centre,
            status: RECRUITER_STATUS.ACTIF,
            jobs: [
              {
                rome_code: ["M1602"],
                is_multi_published: true,
                job_status: JOB_STATUS.ACTIVE,
                job_level_label: NIVEAUX_POUR_LBA["3 (CAP...)"],
              },
              {
                rome_code: ["M1602"],
                is_multi_published: true,
                job_status: JOB_STATUS.ACTIVE,
                job_level_label: NIVEAUX_POUR_LBA["4 (BAC...)"],
              },
            ],
            address_detail: {
              code_insee_localite: parisFixture.code,
            },
          })
        )

        const results = await findJobsOpportunities(
          {
            longitude: parisFixture.centre.coordinates[0],
            latitude: parisFixture.centre.coordinates[1],
            radius: 30,
            romes: ["M1602"],
            diplomaLevel: "4",
            rncp: null,
          },
          new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
        )

        expect.soft(results.jobs).toHaveLength(2)
        expect.soft(results.jobs.map((j) => j.offer_diploma_level)).toEqual(
          expect.arrayContaining([
            null,
            {
              european: "4",
              label: "BP, Bac, autres formations niveau (Bac)",
            },
          ])
        )
      })
    })

    it("should returns only job with the multi published flag", async () => {
      await getDbCollection("recruiters").insertOne(
        generateRecruiterFixture({
          establishment_siret: "11000001500013",
          geopoint: parisFixture.centre,
          status: RECRUITER_STATUS.ACTIF,
          jobs: [
            {
              rome_code: ["M1602"],
              is_multi_published: false,
              job_status: JOB_STATUS.ACTIVE,
              job_level_label: NIVEAUX_POUR_LBA.INDIFFERENT,
            },
          ],
          address_detail: {
            code_insee_localite: parisFixture.code,
          },
        })
      )

      const results = await findJobsOpportunities(
        {
          longitude: parisFixture.centre.coordinates[0],
          latitude: parisFixture.centre.coordinates[1],
          radius: 30,
          romes: ["M1602"],
          rncp: null,
        },
        new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
      )

      expect(results.jobs).toHaveLength(1)
    })

    it("should limit the number of jobs to 150", async () => {
      const JOB_PER_RECRUITER = 10

      const extraRecruiters: IRecruiter[] = Array.from({ length: 500 }, () => {
        const jobs = Array.from({ length: JOB_PER_RECRUITER }, () => ({
          rome_code: ["M1602"],
          is_multi_published: true,
          job_status: JOB_STATUS.ACTIVE,
          job_level_label: NIVEAUX_POUR_LBA.INDIFFERENT,
        }))

        return generateRecruiterFixture({
          establishment_siret: "11000001500013",
          geopoint: parisFixture.centre,
          status: RECRUITER_STATUS.ACTIF,
          jobs,
          address_detail: {
            code_insee_localite: parisFixture.code,
          },
        })
      })

      await getDbCollection("recruiters").deleteMany({})
      await getDbCollection("recruiters").insertMany(extraRecruiters)

      const results = await findJobsOpportunities(
        {
          longitude: parisFixture.centre.coordinates[0],
          latitude: parisFixture.centre.coordinates[1],
          radius: 30,
          romes: ["M1602"],
          rncp: null,
        },
        new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
      )

      expect(results.jobs).toHaveLength(150)
    })

    // A vérifier si le cas existe
    it("should exclude jobs with rome codes without a corresponding referentiel rome", async () => {
      await getDbCollection("recruiters").insertOne(
        generateRecruiterFixture({
          establishment_siret: "11000001500013",
          geopoint: parisFixture.centre,
          status: RECRUITER_STATUS.ACTIF,
          jobs: [
            {
              rome_code: ["C1110"],
              is_multi_published: true,
              job_status: JOB_STATUS.ACTIVE,
              job_level_label: NIVEAUX_POUR_LBA.INDIFFERENT,
            },
          ],
          address_detail: {
            code_insee_localite: parisFixture.code,
          },
        })
      )

      const results = await findJobsOpportunities(
        {
          longitude: parisFixture.centre.coordinates[0],
          latitude: parisFixture.centre.coordinates[1],
          radius: 30,
          romes: ["C1110"],
          rncp: null,
        },
        new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
      )

      expect(results.jobs).toHaveLength(0)
    })

    it("should exclude companies not within the radius", async () => {
      const results = await findJobsOpportunities(
        {
          longitude: clichyFixture.centre.coordinates[0],
          latitude: clichyFixture.centre.coordinates[1],
          radius: 1,
          romes: ["M1602"],
          rncp: null,
        },
        new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
      )

      expect(results.jobs).toHaveLength(0)
    })

    it("should ignore job custom_geo_coordinates", async () => {
      await getDbCollection("recruiters").insertOne(
        generateRecruiterFixture({
          establishment_siret: "11000001500013",
          geopoint: parisFixture.centre,
          status: RECRUITER_STATUS.ACTIF,
          jobs: [
            {
              rome_code: ["M1602"],
              is_multi_published: true,
              job_status: JOB_STATUS.ACTIVE,
              job_level_label: NIVEAUX_POUR_LBA.INDIFFERENT,
              custom_geo_coordinates: `${marseilleFixture.centre.coordinates[1]},${marseilleFixture.centre.coordinates[0]}`,
            },
          ],
          address_detail: {
            code_insee_localite: parisFixture.code,
          },
        })
      )

      const results = await findJobsOpportunities(
        {
          longitude: parisFixture.centre.coordinates[0],
          latitude: parisFixture.centre.coordinates[1],
          radius: 30,
          romes: ["M1602"],
          rncp: null,
        },
        new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
      )

      expect(results.jobs).toHaveLength(2)
    })

    describe("when recruiter is delegated", () => {
      it("should return info from the cfa_delegated_siret", async () => {
        const cfa = generateCfaFixture({
          siret: "78430824900019",
        })
        await getDbCollection("cfas").insertOne(cfa)

        const userWithAccount = generateUserWithAccountFixture({
          phone: "0102030405",
        })

        await getDbCollection("userswithaccounts").insertOne(userWithAccount)

        const delegatedLbaJob = generateRecruiterFixture({
          establishment_siret: "21750001600019",
          establishment_enseigne: "MAIRIE DE PARIS",
          geopoint: parisFixture.centre,
          status: RECRUITER_STATUS.ACTIF,
          jobs: [
            {
              rome_code: ["M1602"],
              is_multi_published: true,
              job_status: JOB_STATUS.ACTIVE,
              job_level_label: NIVEAUX_POUR_LBA.INDIFFERENT,
            },
            {
              rome_code: ["M1602"],
              is_multi_published: true,
              job_status: JOB_STATUS.ACTIVE,
              job_level_label: NIVEAUX_POUR_LBA.INDIFFERENT,
            },
          ],
          address_detail: {
            code_insee_localite: parisFixture.code,
          },
          is_delegated: true,
          cfa_delegated_siret: cfa.siret,
          managed_by: userWithAccount._id.toString(),
        })

        await getDbCollection("recruiters").insertOne(delegatedLbaJob)

        const results = await findJobsOpportunities(
          {
            longitude: parisFixture.centre.coordinates[0],
            latitude: parisFixture.centre.coordinates[1],
            radius: 30,
            romes: ["M1602"],
            rncp: null,
          },
          new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
        )

        expect(results.jobs).toHaveLength(3)
        expect(
          results.jobs.map((j) => ({
            _id: j._id,
            workspace_siret: j.workplace_siret,
            workplace_geopoint: j.workplace_geopoint,
            apply_phone: j.apply_phone,
          }))
        ).toEqual(
          expect.arrayContaining([
            {
              _id: lbaJobs[0].jobs[0]._id.toString(),
              workplace_geopoint: lbaJobs[0].geopoint,
              workspace_siret: lbaJobs[0].establishment_siret,
              apply_phone: lbaJobs[0].phone,
            },
            {
              _id: delegatedLbaJob.jobs[0]._id.toString(),
              workplace_geopoint: delegatedLbaJob.geopoint,
              workspace_siret: cfa.siret,
              apply_phone: userWithAccount.phone,
            },
            {
              _id: delegatedLbaJob.jobs[1]._id.toString(),
              workplace_geopoint: delegatedLbaJob.geopoint,
              workspace_siret: cfa.siret,
              apply_phone: userWithAccount.phone,
            },
          ])
        )
      })
    })
  })

  describe("jobs partners", () => {
    beforeEach(async () => {
      vi.mocked(searchForFtJobs).mockResolvedValue({ resultats: [] })
    })
    it("should limit jobs to 150", async () => {
      const extraOffers: IJobsPartnersOfferPrivate[] = Array.from({ length: 300 }, () =>
        generateJobsPartnersOfferPrivate({
          workplace_geopoint: parisFixture.centre,
          offer_rome_code: ["M1602"],
        })
      )
      await getDbCollection("jobs_partners").insertMany(extraOffers)
      await getDbCollection("recruiters").deleteMany({})

      const results = await findJobsOpportunities(
        {
          longitude: parisFixture.centre.coordinates[0],
          latitude: parisFixture.centre.coordinates[1],
          radius: 30,
          romes: ["M1602"],
          rncp: null,
        },
        new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
      )

      expect(results.jobs).toHaveLength(150)
    })

    it("should exclude companies not within the radius", async () => {
      await getDbCollection("recruiters").deleteMany({})

      const results = await findJobsOpportunities(
        {
          longitude: clichyFixture.centre.coordinates[0],
          latitude: clichyFixture.centre.coordinates[1],
          radius: 1,
          romes: ["M1602"],
          rncp: null,
        },
        new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
      )

      expect(results.jobs).toHaveLength(0)
    })

    it("should not include offer_multicast=false jobs", async () => {
      await getDbCollection("jobs_partners").insertOne(
        generateJobsPartnersOfferPrivate({
          offer_rome_code: ["M1602"],
          workplace_geopoint: parisFixture.centre,
          offer_multicast: false,
        })
      )
      await getDbCollection("recruiters").deleteMany({})

      const results = await findJobsOpportunities(
        {
          longitude: parisFixture.centre.coordinates[0],
          latitude: parisFixture.centre.coordinates[1],
          radius: 30,
          romes: ["M1602"],
          rncp: null,
        },
        new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
      )

      expect(results.jobs).toHaveLength(1)
    })

    describe("when filtered by diploma", () => {
      beforeEach(async () => {
        await getDbCollection("jobs_partners").insertMany([
          generateJobsPartnersOfferPrivate({
            offer_rome_code: ["M1602"],
            workplace_geopoint: parisFixture.centre,
            offer_diploma_level: { european: "4", label: "BP, Bac, autres formations niveau (Bac)" },
          }),
          generateJobsPartnersOfferPrivate({
            offer_rome_code: ["M1602"],
            workplace_geopoint: parisFixture.centre,
            offer_diploma_level: { european: "3", label: "CAP, BEP, autres formations niveau (CAP)" },
          }),
        ])
        await getDbCollection("recruiters").deleteMany({})
      })

      it("should return jobs with requested diploma and unknown ones only", async () => {
        const results = await findJobsOpportunities(
          {
            longitude: parisFixture.centre.coordinates[0],
            latitude: parisFixture.centre.coordinates[1],
            radius: 30,
            romes: ["M1602"],
            diplomaLevel: "3",
            rncp: null,
          },
          new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
        )

        expect(results.jobs).toHaveLength(2)
        expect(results.jobs.map((j) => j.offer_diploma_level)).toEqual([null, { european: "3", label: "CAP, BEP, autres formations niveau (CAP)" }])
      })
    })
  })

  describe("france travail jobs", () => {
    beforeEach(async () => {
      await getDbCollection("jobs_partners").deleteMany({})
      await getDbCollection("recruiters").deleteMany({})
    })

    describe("when france travail api returns an error", () => {
      it("should ignore france travail jobs", async () => {
        vi.mocked(searchForFtJobs).mockRejectedValue(new Error("oops"))

        const results = await findJobsOpportunities(
          {
            longitude: parisFixture.centre.coordinates[0],
            latitude: parisFixture.centre.coordinates[1],
            radius: 30,
            romes: ["M1602"],
            rncp: null,
          },
          new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
        )

        expect(results.jobs).toHaveLength(0)
        expect(results.warnings).toEqual([
          {
            code: "FRANCE_TRAVAIL_API_ERROR",
            message: "Unable to retrieve job offers from France Travail API",
          },
        ])
      })
    })

    it("should select jobs within the radius", async () => {
      vi.mocked(searchForFtJobs).mockResolvedValue({ resultats: [] })

      const results = await findJobsOpportunities(
        {
          longitude: clichyFixture.centre.coordinates[0],
          latitude: clichyFixture.centre.coordinates[1],
          radius: 100,
          romes: ["M1602"],
          rncp: null,
        },
        new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
      )

      expect(results.jobs).toHaveLength(0)
      expect(results.warnings).toHaveLength(0)

      expect(searchForFtJobs).toHaveBeenCalledTimes(1)
      expect(searchForFtJobs).toHaveBeenCalledWith(
        {
          codeROME: "M1602",
          commune: clichyFixture.code,
          sort: 2,
          natureContrat: "E2,FS",
          range: "0-149",
          distance: 100,
        },
        { throwOnError: true }
      )
    })

    describe("when searching for jobs with a specific diploma", () => {
      it.each<[INiveauDiplomeEuropeen, (typeof NIVEAUX_POUR_OFFRES_PE)[keyof typeof NIVEAUX_POUR_OFFRES_PE]]>([
        ["3", "NV5"],
        ["4", "NV4"],
        ["5", "NV3"],
        ["6", "NV2"],
        ["7", "NV1"],
      ])("should support filter by diploma %s as level %s", async (diplomaLevel, ftLevel) => {
        vi.mocked(searchForFtJobs).mockResolvedValue({ resultats: [] })

        const results = await findJobsOpportunities(
          {
            longitude: clichyFixture.centre.coordinates[0],
            latitude: clichyFixture.centre.coordinates[1],
            radius: 30,
            romes: ["M1602"],
            diplomaLevel,
            rncp: null,
          },
          new JobOpportunityRequestContext({ path: "/api/route" }, "api-alternance")
        )

        expect(results.jobs).toHaveLength(0)
        expect(results.warnings).toHaveLength(0)

        expect(searchForFtJobs).toHaveBeenCalledTimes(1)
        expect(searchForFtJobs).toHaveBeenCalledWith(
          {
            codeROME: "M1602",
            commune: clichyFixture.code,
            sort: 2,
            natureContrat: "E2,FS",
            range: "0-149",
            distance: 30,
            niveauFormation: ftLevel,
          },
          { throwOnError: true }
        )
      })
    })
  })
})

describe("createJobOffer", () => {
  const identity: IApiApprentissageTokenData = {
    email: "mail@mailType.com",
    organisation: "Some organisation",
    habilitations: {
      "jobs:write": true,
    },
  }

  const now = new Date("2024-06-18T00:00:00.000Z")
  const in2Month = new Date("2024-08-17T22:00:00.000Z")
  const inSept = new Date("2024-09-01T00:00:00.000Z")

  const minimalData: IJobsPartnersWritableApi = {
    partner_job_id: null,

    contract_start: inSept,
    contract_duration: null,
    contract_type: null,
    contract_remote: null,

    offer_title: "Apprentis en développement web",
    offer_rome_code: ["M1602"],
    offer_desired_skills: [],
    offer_to_be_acquired_skills: [],
    offer_access_conditions: [],
    offer_creation: null,
    offer_expiration: null,
    offer_opening_count: 1,
    offer_origin: null,
    offer_multicast: true,
    offer_description: "Envie de devenir développeur web ? Rejoignez-nous !",
    offer_diploma_level_european: null,

    apply_url: null,
    apply_email: null,
    apply_phone: null,

    workplace_siret: apiEntrepriseEtablissementFixture.dinum.data.siret,
    workplace_address_label: null,
    workplace_description: null,
    workplace_website: null,
  }

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)

    vi.mocked(getEtablissementFromGouvSafe).mockResolvedValue(apiEntrepriseEtablissementFixture.dinum)

    nock("https://api-adresse.data.gouv.fr:443")
      .get("/search")
      .query({ q: "20 AVENUE DE SEGUR, 75007 PARIS", limit: "1" })
      .reply(200, {
        features: [{ geometry: parisFixture.centre }],
      })

    await getDbCollection("opcos").insertOne({
      _id: new ObjectId(),
      siren: "130025265",
      opco: "AKTO / Opco entreprises et salariés des services à forte intensité de main d'oeuvre",
      opco_short_name: "AKTO",
      idcc: "1459",
      url: null,
    })

    return () => {
      vi.useRealTimers()
    }
  })

  it("should create a job offer with the minimal data", async () => {
    const result = await createJobOffer(identity, minimalData)
    expect(result).toBeInstanceOf(ObjectId)

    const job = await getDbCollection("jobs_partners").findOne({ _id: result })
    expect(job?.created_at).toEqual(now)
    expect(job?.partner).toEqual(identity.organisation)
    expect(job?.offer_rome_code).toEqual(["M1602"])
    expect(job?.offer_status).toEqual(JOB_STATUS.ACTIVE)
    expect(job?.offer_creation).toEqual(now)
    expect(job?.offer_expiration).toEqual(in2Month)
    expect(job?.offer_diploma_level).toEqual(null)
    expect(job?.workplace_geopoint).toEqual(parisFixture.centre)
    expect(job?.workplace_address?.label).toEqual("20 AVENUE DE SEGUR 75007 PARIS")

    expect(job).toMatchSnapshot({
      _id: expect.any(ObjectId),
    })

    expect(nock.isDone()).toBeTruthy()
  })

  it("should get default rome from ROMEO", async () => {
    vi.mocked(getRomeoPredictions).mockResolvedValue(franceTravailRomeoFixture["Software Engineer"])

    const result = await createJobOffer(identity, { ...minimalData, offer_rome_code: [] })
    expect(result).toBeInstanceOf(ObjectId)

    const job = await getDbCollection("jobs_partners").findOne({ _id: result })
    expect(job?.offer_rome_code).toEqual(["E1206"])
    expect(nock.isDone()).toBeTruthy()
  })

  it('should get workplace location from given "workplace_address_label"', async () => {
    nock("https://api-adresse.data.gouv.fr:443")
      .get("/search")
      .query({ q: "1T impasse Passoir Clichy", limit: "1" })
      .reply(200, {
        features: [{ geometry: clichyFixture.centre }],
      })

    const result = await createJobOffer(identity, { ...minimalData, workplace_address_label: "1T impasse Passoir Clichy" })
    expect(result).toBeInstanceOf(ObjectId)

    const job = await getDbCollection("jobs_partners").findOne({ _id: result })
    expect(job?.workplace_address).toEqual({ label: "1T impasse Passoir Clichy" })
    expect(job?.workplace_geopoint).toEqual(clichyFixture.centre)
    expect(nock.isDone()).toBeTruthy()
  })
})

describe("updateJobOffer", () => {
  const _id = new ObjectId()
  const identity: IApiApprentissageTokenData = {
    email: "mail@mailType.com",
    organisation: "Some organisation",
    habilitations: {
      "jobs:write": true,
    },
  }

  const originalCreatedAt = new Date("2023-09-06T00:00:00.000+02:00")
  const originalCreatedAtPlus2Months = new Date("2023-11-06T00:00:00.000+01:00")
  const now = new Date("2024-06-18T00:00:00.000Z")
  const inSept = new Date("2024-09-01T00:00:00.000Z")

  const originalJob = generateJobsPartnersOfferPrivate({
    _id,
    partner: identity.organisation,
    created_at: originalCreatedAt,
    offer_creation: originalCreatedAt,
    offer_expiration: originalCreatedAtPlus2Months,
  })

  const minimalData: IJobsPartnersWritableApi = {
    partner_job_id: null,

    contract_start: inSept,
    contract_duration: null,
    contract_type: null,
    contract_remote: null,

    offer_title: "Apprentis en développement web",
    offer_rome_code: ["M1602"],
    offer_desired_skills: [],
    offer_to_be_acquired_skills: [],
    offer_access_conditions: [],
    offer_creation: null,
    offer_expiration: null,
    offer_opening_count: 1,
    offer_origin: null,
    offer_multicast: true,
    offer_description: "Envie de devenir développeur web ? Rejoignez-nous !",
    offer_diploma_level_european: null,

    apply_url: null,
    apply_email: null,
    apply_phone: null,

    workplace_siret: apiEntrepriseEtablissementFixture.dinum.data.siret,
    workplace_address_label: null,
    workplace_description: null,
    workplace_website: null,
  }

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)

    vi.mocked(getEtablissementFromGouvSafe).mockResolvedValue(apiEntrepriseEtablissementFixture.dinum)

    nock("https://api-adresse.data.gouv.fr:443")
      .get("/search")
      .query({ q: "20 AVENUE DE SEGUR, 75007 PARIS", limit: "1" })
      .reply(200, {
        features: [{ geometry: parisFixture.centre }],
      })

    await getDbCollection("jobs_partners").insertOne(originalJob)

    await getDbCollection("opcos").insertOne({
      _id: new ObjectId(),
      siren: "130025265",
      opco: "AKTO / Opco entreprises et salariés des services à forte intensité de main d'oeuvre",
      opco_short_name: "AKTO",
      idcc: "1459",
      url: null,
    })

    return () => {
      vi.useRealTimers()
    }
  })

  it("should update a job offer with the minimal data", async () => {
    await updateJobOffer(_id, identity, minimalData)

    const job = await getDbCollection("jobs_partners").findOne({ _id })
    expect(job?.created_at).toEqual(originalCreatedAt)
    expect(job?.partner).toEqual(identity.organisation)
    expect(job?.offer_rome_code).toEqual(["M1602"])
    expect(job?.offer_status).toEqual(JOB_STATUS.ACTIVE)
    expect(job?.offer_creation).toEqual(originalCreatedAt)
    // TODO: figure out if the expiration should be updated
    expect(job?.offer_expiration).toEqual(originalCreatedAtPlus2Months)
    expect(job?.offer_diploma_level).toEqual(null)
    expect(job?.workplace_geopoint).toEqual(parisFixture.centre)
    expect(job?.workplace_address?.label).toEqual("20 AVENUE DE SEGUR 75007 PARIS")

    expect(job).toMatchSnapshot({
      _id: expect.any(ObjectId),
    })

    expect(nock.isDone()).toBeTruthy()
  })

  it("should get default rome from ROMEO", async () => {
    vi.mocked(getRomeoPredictions).mockResolvedValue(franceTravailRomeoFixture["Software Engineer"])

    await updateJobOffer(_id, identity, { ...minimalData, offer_rome_code: [] })

    const job = await getDbCollection("jobs_partners").findOne({ _id })
    expect(job?.offer_rome_code).toEqual(["E1206"])
    expect(nock.isDone()).toBeTruthy()
  })

  it('should get workplace location from given "workplace_address_label"', async () => {
    nock("https://api-adresse.data.gouv.fr:443")
      .get("/search")
      .query({ q: "1T impasse Passoir Clichy", limit: "1" })
      .reply(200, {
        features: [{ geometry: clichyFixture.centre }],
      })

    await updateJobOffer(_id, identity, { ...minimalData, workplace_address_label: "1T impasse Passoir Clichy" })

    const job = await getDbCollection("jobs_partners").findOne({ _id })
    expect(job?.workplace_address).toEqual({ label: "1T impasse Passoir Clichy" })
    expect(job?.workplace_geopoint).toEqual(clichyFixture.centre)
    expect(nock.isDone()).toBeTruthy()
  })
})
