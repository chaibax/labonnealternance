import { Box, Button, Circle, Flex, Heading, Link, Stack, Text, useToast } from "@chakra-ui/react"
import dayjs from "dayjs"
import { useContext, useEffect, useState } from "react"
import { useQuery, useQueryClient } from "react-query"
import { useLocation, useNavigate } from "react-router-dom"
import { getUser, sendValidationLink } from "../../api"
import { AuthentificationLayout } from "../../components"
import { WidgetContext } from "../../contextWidget"
import { InfoCircle } from "../../theme/components/icons"
import { MailCloud } from "../../theme/components/logos"

export default () => {
  const [disableLink, setDisableLink] = useState(false)
  const [userIsValidated, setUserIsValidated] = useState(false)
  const [title, setTitle] = useState("")
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const client = useQueryClient()

  const { widget } = useContext(WidgetContext)
  const { offre, email, withDelegation, fromDashboard, userId } = location.state

  useQuery("userdetail", () => getUser(userId), {
    onSuccess: (data) => {
      if (data.data.etat_utilisateur[0].statut === "VALIDÉ") {
        setUserIsValidated(true)
      }
    },
  })

  const getTextualContext = () => {
    switch (withDelegation) {
      case true:
        if (userIsValidated) {
          setTitle("Félicitations,<br>votre offre a bien été créée et transmise aux organismes de formation que vous avez sélectionnés.")
        } else {
          setTitle(
            "Félicitations,<br>votre offre a bien été créée.<br>Elle sera publiée et transmise aux organismes de formation que vous avez sélectionnés dès validation de votre compte."
          )
        }
        break

      case false:
        if (userIsValidated) {
          setTitle("Félicitations,<br>votre offre a bien été créée!")
        } else {
          setTitle("Félicitations,<br>votre offre a bien été créée.<br>Elle sera publiée dès validation de votre compte.")
        }
        break

      default:
        break
    }
  }

  const resendMail = (email) => {
    sendValidationLink({ email })
      .then(() => {
        toast({
          title: "Email envoyé.",
          description: "Un nouveau email vient d'être envoyé.",
          position: "top-right",
          status: "success",
          duration: 4000,
        })
      })
      .catch((error) => {
        if (error.response.error) {
          switch (error.response.reason) {
            case "UNKNOWN":
              toast({
                title: "Un problème est survenu.",
                description: "L'email n'a pas pu être vérfié, merci de contacter le support.",
                position: "top-right",
                status: "success",
                duration: 4000,
              })
              break
            case "VERIFIED":
              toast({
                title: "L'email est déjà vérifié.",
                description: "Vous pouvez vous connecter.",
                position: "top-right",
                status: "success",
                duration: 4000,
              })
              break
          }
        }
      })
      .finally(() => {
        setDisableLink(true)
      })
  }

  /**
   * @description On close from dahboard, return to offre-liste.
   * @return {Promise<void>}
   */
  const onClose = async () => {
    await client.invalidateQueries("offre-liste")
    navigate(-1)
  }

  const ValidatedAccountDescription = () => {
    return (
      <>
        <Flex alignItems="flex-start" mb={6}>
          <InfoCircle mr={2} mt={1} />
          <Box>
            <Heading>Confirmez votre email</Heading>
            <Text textAlign="justify">
              Afin de finaliser la diffusion de votre besoin auprès des jeunes, merci de confirmer votre adresse mail en cliquant sur le lien que nous venons de vous transmettre à
              l’adresse suivante: <span style={{ fontWeight: "700" }}>{email}</span>.
            </Text>
          </Box>
        </Flex>
        <Flex align="center" ml={5} mb="16px">
          <Text>Vous n’avez pas reçu le mail ? </Text>
          <Button as={Link} variant="classic" textDecoration="underline" onClick={() => resendMail(email)} isDisabled={disableLink}>
            Renvoyer le mail
          </Button>
        </Flex>
      </>
    )
  }
  const AwaitingAccountDescription = () => {
    return (
      <Stack spacing={4} my={4}>
        <Text>Voici les prochains étapes qui vous attendent :</Text>
        <Stack direction="row" spacing={4}>
          <Circle p={5} size="20px" bg="#E3E3FD" color="#000091" fontWeight="700">
            1
          </Circle>
          <Box>
            <Heading fontSize="18px">Confirmez votre email</Heading>
            <Text>
              Afin de finaliser la diffusion de votre besoin auprès des jeunes, merci de confirmer votre adresse mail en cliquant sur le lien que nous venons de vous transmettre à
              l’adresse suivante: <span style={{ fontWeight: "700" }}>{email}</span>.
            </Text>
            <Flex align="center">
              <Text>Vous n’avez pas reçu le mail ? </Text>
              <Button as={Link} variant="classic" textDecoration="underline" onClick={() => resendMail(email)} isDisabled={disableLink}>
                Renvoyer le mail
              </Button>
            </Flex>
          </Box>
        </Stack>
        <Stack direction="row" spacing={4}>
          <Circle p={5} size="20px" bg="#E3E3FD" color="#000091" fontWeight="700">
            2
          </Circle>
          <Box>
            <Heading fontSize="18px">Votre compte sera validé manuellement par nos équipes</Heading>
            <Text>Vous serez notifié par email une fois que ce sera fait.</Text>
          </Box>
        </Stack>
        <Stack direction="row" spacing={4}>
          <Circle p={5} size="20px" bg="#E3E3FD" color="#000091" fontWeight="700">
            3
          </Circle>
          <Box>
            <Heading fontSize="18px">Votre offre est automatiquement publiée </Heading>
            <Text>Une fois votre compte validé, votre offre est automatiquement publiée et partagée aux organismes de formation que vous avez sélectionnés.</Text>
          </Box>
        </Stack>
      </Stack>
    )
  }

  useEffect(() => getTextualContext(), [withDelegation])

  return (
    <AuthentificationLayout fromDashboard={fromDashboard} onClose={onClose}>
      <Flex direction={["column", widget?.mobile ? "column" : "row"]} align={widget?.mobile ? "center" : "flex-start"} border="1px solid #000091" mt={[4, 8]} p={[4, 8]}>
        <MailCloud style={{ paddingRight: "10px" }} />
        <Box pt={[3, 0]} ml={10}>
          <Heading fontSize="24px" mb="16px" mt={widget?.mobile ? "10px" : "0px"}>
            <div dangerouslySetInnerHTML={{ __html: title }} />
          </Heading>
          {userIsValidated ? <ValidatedAccountDescription /> : <AwaitingAccountDescription />}
          <Box bg="#F6F6F6" p={4}>
            <Stack direction="column" spacing="16px" mt={fromDashboard ? 10 : 0}>
              <Heading fontSize="20px">Récapitulatif de votre besoin</Heading>
              <Text>
                Poste : <span style={{ fontWeight: "700" }}>{offre.rome_appellation_label}</span>
              </Text>
              <Text>
                Niveau d'étude visé : <span style={{ fontWeight: "700" }}>{offre.niveau}</span>
              </Text>
              <Text>
                Date de début d'apprentissage souhaitée : <span style={{ fontWeight: "700" }}>{dayjs(offre.date_debut_apprentissage).format("DD/MM/YYYY")}</span>
              </Text>
              <Text fontSize="14px">Votre offre expirera après 30 jours à compter de sa publication</Text>
            </Stack>
          </Box>
        </Box>
      </Flex>
    </AuthentificationLayout>
  )
}
