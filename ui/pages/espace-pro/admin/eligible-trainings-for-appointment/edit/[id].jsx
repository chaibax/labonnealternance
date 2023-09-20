import { ExternalLinkIcon } from "@chakra-ui/icons"
import { Box, Button, Checkbox, Editable, EditableInput, EditablePreview, Flex, Heading, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr, useToast } from "@chakra-ui/react"
// eslint-disable-next-line import/no-extraneous-dependencies
import emailValidator from "email-validator" // TODO_AB
import Head from "next/head"
import { useRouter } from "next/router"
import React, { createRef, useEffect, useState } from "react"

import { formatDate } from "../../../../../common/dayjs"
import { _get, _patch } from "../../../../../common/httpClient"
import EtablissementComponent from "../../../../../components/espace_pro/Admin/widgetParameters/components/EtablissementComponent"
import { Breadcrumb } from "../../../../../components/espace_pro/common/components/Breadcrumb"

/**
 * @description Page that handle formation editions.
 * @returns {JSX.Element}
 */
export default function EditPage() {
  const router = useRouter()
  const { id } = router.query
  const [eligibleTrainingsForAppointmentResult, setEligibleTrainingsForAppointmentResult] = useState()
  const [referrers, setReferrers] = useState()
  const [etablissement, setEtablissement] = useState()
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const title = "Gestion de l'établissement"

  /**
   * @description Fetch initial data.
   * @return {Promise<void>}
   */
  const fetchData = async () => {
    try {
      setLoading(true)
      const [parametersResponse, referrers, etablissementResponse] = await Promise.all([getEligibleTrainingsForAppointments(id), getReferrers(), getEtablissement(id)])

      setEligibleTrainingsForAppointmentResult(parametersResponse)
      setReferrers(referrers)
      setEtablissement(etablissementResponse)
    } catch (error) {
      toast({
        title: "Une erreur est survenue durant la récupération des informations.",
        status: "error",
        isClosable: true,
        position: "bottom-right",
      })
    } finally {
      setLoading(false)
    }
  }

  /**
   * @description Get all parameters.
   */
  useEffect(() => {
    if (id) fetchData()
  }, [id, toast])

  /**
   * @description Refresh parameters.
   * @returns {Promise<void>}
   */
  const refreshParameters = async () => {
    const parametersResponse = await getEligibleTrainingsForAppointments(id)

    setEligibleTrainingsForAppointmentResult(parametersResponse)
  }

  /**
   * @description Returns all parameters from given sirent.
   * @param {String} id
   * @returns {Promise<*>}
   */
  const getEligibleTrainingsForAppointments = (id) => _get(`admin/eligible-trainings-for-appointment?query={"etablissement_formateur_siret":"${id}"}&limit=1000`)

  /**
   * @description Returns etablissement from its SIRET.
   * @param {String} siret
   * @returns {Promise<*>}
   */
  const getEtablissement = (siret) => _get(`admin/etablissements/siret-formateur/${siret}`)

  /**
   * @description Returns all referrers.
   * @returns {Promise<{code: {number}, name: {string}, full_name: {string}, url: {string}[]}>}
   */
  const getReferrers = async () => {
    const { referrers } = await _get(`constants`)

    return referrers
  }

  /**
   * @description Patch eligibleTrainingsForAppointments.
   * @param {string} id
   * @param {Object} body
   * @returns {Promise<void>}
   */
  const patchEligibleTrainingsForAppointment = async (id, body) => {
    await _patch(`admin/eligible-trainings-for-appointment/${id}`, body)
  }

  /**
   * @description Save email.
   * @param parameterId
   * @param email
   * @returns {Promise<string|number>}
   */
  const saveEmail = async (parameterId, email) => {
    if (!email && !emailValidator.validate(email)) {
      return toast({
        title: "Email de contact non valide.",
        status: "error",
        isClosable: true,
        position: "bottom-right",
      })
    }

    await patchEligibleTrainingsForAppointment(parameterId, {
      lieu_formation_email: email,
      is_lieu_formation_email_customized: true,
    })

    toast({
      title: "Email de contact mis à jour.",
      status: "success",
      isClosable: true,
      position: "bottom-right",
    })
  }

  /**
   * @description Disable/enable email overriding.
   * @param id
   * @param is_lieu_formation_email_customized
   * @return {Promise<void>}
   */
  const disableEmailOverriding = async (id, is_lieu_formation_email_customized) => {
    await patchEligibleTrainingsForAppointment(id, { is_lieu_formation_email_customized })
    if (is_lieu_formation_email_customized) {
      toast({
        title: "Lors de la prochaine synchronisation l'email ne sera pas écrasé car il est personnalisé.",
        status: "success",
        isClosable: true,
        position: "bottom-right",
      })
    } else {
      toast({
        title: "L'email sera mis à jour automatiquement lors de la prochaine synchronisation avec le Catalogue.",
        status: "success",
        isClosable: true,
        position: "bottom-right",
      })
    }
  }

  /**
   * @description Handle referrer checkbox.
   * @param {Object} parameter
   * @param {Boolean} checked
   * @param {Object} referrer
   * @returns {Promise<void>}
   */
  const onCheckboxChange = async ({ parameter, checked, referrer }) => {
    // Add referrer
    if (checked) {
      await patchEligibleTrainingsForAppointment(parameter._id, {
        referrers: parameter.referrers.map((ref) => ref).concat(referrer.name),
      })
      await refreshParameters()
    } else {
      await patchEligibleTrainingsForAppointment(parameter._id, {
        referrers: parameter.referrers.map((ref) => ref).filter((item) => item !== referrer.name),
      })
      await refreshParameters()
    }
  }

  if (!eligibleTrainingsForAppointmentResult) {
    return <Spinner display="block" mx="auto" mt="10rem" />
  }

  return (
    <Box w="100%" pt={[4, 8]} px={[1, 1, 12, 24]} pb={40}>
      <Head>
        <title>{title}</title>
        <link rel="icon" href="/favicon/favicon.ico" />
      </Head>
      <Breadcrumb pages={[{ title: "Administration", to: "/admin" }, { title: title }]} />
      <Heading textStyle="h2" mt={5}>
        {title}
      </Heading>
      <Box>
        {eligibleTrainingsForAppointmentResult && etablissement && !loading && (
          <>
            <EtablissementComponent id={etablissement._id} />
            <Flex bg="white" mt={10} border="1px solid #E0E5ED" borderRadius="4px" borderBottom="none">
              <Text flex="1" fontSize="16px" p={5}>
                Formations
              </Text>
            </Flex>
            <Box border="1px solid #E0E5ED" overflow="auto" cursor="pointer">
              <Table w="150rem" bg="white">
                <Thead color="#ADB2BC">
                  <Tr>
                    <Th textStyle="sm">Catalogue</Th>
                    <Th textStyle="sm">CLE MINISTERE EDUCATIF</Th>
                    <Th textStyle="sm">INTITULE</Th>
                    <Th textStyle="sm">CODE POSTAL</Th>
                    <Th textStyle="sm">ADRESSE</Th>
                    <Th textStyle="sm">LIEU FORMATION EMAIL</Th>
                    <Th textStyle="sm">DESACTIVER L'ECRASEMENT DU MAIL VIA LA SYNCHRONISATION CATALOGUE</Th>
                    <Th textStyle="sm">PUBLIE SUR LE CATALOGUE</Th>
                    <Th textStyle="sm">PARCOURSUP ID</Th>
                    <Th textStyle="sm">DERNIERE SYNCHRONISATION CATALOGUE</Th>
                    <Th textStyle="sm">SOURCE</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {eligibleTrainingsForAppointmentResult.parameters.map((parameter) => {
                    const emailRef = createRef()
                    const emailFocusRef = createRef()

                    return (
                      <Tr key={parameter._id} _hover={{ bg: "#f4f4f4", transition: "0.5s" }} transition="0.5s">
                        <Td>
                          <a
                            href={`https://catalogue-apprentissage.intercariforef.org/recherche/formations?SEARCH=%22${encodeURIComponent(parameter.cle_ministere_educatif)}%22`}
                            title="Lien vers la formation du Catalogue"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLinkIcon w={6} h={6} />
                          </a>
                        </Td>
                        <Td>{parameter?.cle_ministere_educatif}</Td>
                        <Td>{parameter.training_intitule_long}</Td>
                        <Td>{parameter.etablissement_formateur_zip_code}</Td>
                        <Td>{parameter.etablissement_formateur_street}</Td>
                        <Td onClick={() => emailFocusRef.current.focus()}>
                          <Editable
                            defaultValue={parameter?.lieu_formation_email}
                            style={{
                              border: "solid #dee2e6 1px",
                              padding: 5,
                              marginRight: 10,
                              borderRadius: 4,
                              minWidth: 350,
                            }}
                          >
                            <EditableInput ref={emailRef} type="email" _focus={{ border: "none" }} />
                            <EditablePreview ref={emailFocusRef} />
                          </Editable>
                          <Button mt={4} variant="primary" onClick={() => saveEmail(parameter._id, emailRef.current.value)}>
                            OK
                          </Button>
                        </Td>
                        <Td align="center">
                          <Checkbox
                            isChecked={parameter?.is_lieu_formation_email_customized}
                            defaultChecked={parameter?.is_lieu_formation_email_customized}
                            onChange={(event) => disableEmailOverriding(parameter._id, event.target.checked)}
                          />
                        </Td>
                        <Td>{parameter?.is_catalogue_published ? "Oui" : "Non"}</Td>
                        <Td>{parameter?.parcoursup_id || "N/C"}</Td>
                        <Td>{parameter?.last_catalogue_sync_date ? formatDate(parameter?.last_catalogue_sync_date) : "N/A"}</Td>
                        <Td>
                          {referrers.map((referrer, i) => {
                            const parameterReferrers = parameter.referrers?.find((parameterReferrer) => parameterReferrer === referrer.name)
                            return (
                              <Flex mt={1} key={i}>
                                <Checkbox
                                  key={referrer.name}
                                  isChecked={!!parameterReferrers}
                                  value={!!parameterReferrers}
                                  defaultChecked={!!parameterReferrers}
                                  onChange={(event) =>
                                    onCheckboxChange({
                                      parameter,
                                      referrer,
                                      checked: event.target.checked,
                                    })
                                  }
                                >
                                  <Text ml={2}>{referrer.name}</Text>
                                </Checkbox>
                              </Flex>
                            )
                          })}
                        </Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            </Box>
          </>
        )}
      </Box>
    </Box>
  )
}

// TODO_AB add HOC restriction page PRIVATE ROUTE redirect to admin/login
