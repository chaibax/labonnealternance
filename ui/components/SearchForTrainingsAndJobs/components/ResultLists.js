import React, { useContext, useState } from "react"

import { ErrorMessage } from "../../../components"
import DisplayMapButton from "../../../components/DisplayMapButton/displayMapButton"
import { DisplayContext } from "../../../context/DisplayContextProvider"
import { ParameterContext } from "../../../context/ParameterContextProvider"
import { ScopeContext } from "../../../context/ScopeContext"
import { SearchResultContext } from "../../../context/SearchResultContextProvider"
import purpleFilterIcon from "../../../public/images/icons/purpleFilter.svg"
import { isCfaEntreprise } from "../../../services/cfaEntreprise"
import { mergeJobs, mergeOpportunities } from "../../../utils/itemListUtils"
import { filterLayers } from "../../../utils/mapTools"
import DuoContainer from "./DuoContainer"
import ExtendedSearchButton from "./ExtendedSearchButton"
import NoJobResult from "./NoJobResult"
import ResultListsCounter from "./ResultListsCounter"

import { Box, Button, Flex, Image } from "@chakra-ui/react"
import { SendPlausibleEvent } from "../../../utils/plausible"
import { renderJob, renderLbb, renderTraining } from "../services/renderOneResult"

const ResultLists = (props) => {
  const scopeContext = useContext(ScopeContext)

  let [extendedSearch, hasSearch, isFormVisible] = [false, false, false]

  ;({ isFormVisible } = useContext(DisplayContext))
  ;({ extendedSearch, hasSearch } = useContext(SearchResultContext))

  if (props.isTestMode) {
    ;[extendedSearch, hasSearch, isFormVisible] = [props.stubbedExtendedSearch, props.stubbedHasSearch, props.stubbedIsFormVisible]
  }

  const filterButtonClicked = (filterButton) => {
    props.setActiveFilter(filterButton)
    filterLayers(filterButton)
    if (filterButton === "duo") {
      SendPlausibleEvent("Clic onglet formations+emplois - Liste de résultats")
    }
  }

  const getTrainingResult = () => {
    if (hasSearch && scopeContext.isTraining && (props.activeFilter === "all" || props.activeFilter === "trainings")) {
      return (
        <Box bg="beige" id="trainingResult">
          {getTrainingList()}
        </Box>
      )
    } else {
      return ""
    }
  }

  const getTrainingList = () => {
    if (props.trainings.length) {
      return (
        <>
          {props.searchRadius < props.trainings[0].place.distance && (
            <Box fontWeight={700} ml={4} px={4} py={4}>
              Aucune formation ne correspondait à votre zone de recherche, nous avons trouvé les plus proches
            </Box>
          )}
          {props.trainings.map((training, idx) => {
            const isCfa = isCfaEntreprise(training?.company?.siret, training?.company?.headquarter?.siret)

            return renderTraining(props.isTestMode, idx, training, props.handleSelectItem, props.searchForJobsOnNewCenter, isCfa)
          })}
        </>
      )
    } else if (!props.isTrainingSearchLoading) {
      if (props.trainings.length === 0) {
        return (
          <Box mx={6} my={4} fontWeight={700}>
            Aucune formation en alternance disponible pour ce métier
          </Box>
        )
      } else return <ErrorMessage message="Problème momentané d'accès aux offres de formation" />
    }
  }

  const getJobResult = () => {
    if (hasSearch && !props.isJobSearchLoading && (props.activeFilter === "all" || props.activeFilter === "jobs")) {
      if (props.allJobSearchError) return ""

      const jobCount = getJobCount(props.jobs)

      if (jobCount) {
        if (extendedSearch) {
          const mergedJobList = getMergedJobList()
          return (
            <Box bg="beige" id="jobList">
              {mergedJobList ? <>{mergedJobList}</> : ""}
            </Box>
          )
        } else {
          const jobList = getJobList()
          const lbbCompanyList = getLbbCompanyList()
          return (
            <Box bg="beige" id="jobList" textAlign="center">
              {jobList || lbbCompanyList ? (
                <>
                  {jobList}
                  {lbbCompanyList}
                  {jobCount < 100 ? <ExtendedSearchButton title="Voir plus de résultats" handleExtendedSearch={props.handleExtendedSearch} /> : ""}
                </>
              ) : (
                <Box m={6}>
                  <NoJobResult />
                  <ExtendedSearchButton title="Étendre la sélection" handleExtendedSearch={props.handleExtendedSearch} />
                </Box>
              )}
            </Box>
          )
        }
      } else {
        if (extendedSearch) return <NoJobResult />
        else
          return (
            <Box m={6}>
              <NoJobResult />
              <ExtendedSearchButton title="Étendre la sélection" handleExtendedSearch={props.handleExtendedSearch} />
            </Box>
          )
      }
    } else {
      return ""
    }
  }

  const getJobCount = (jobs) => {
    let jobCount = 0

    if (jobs) {
      if (jobs.peJobs) jobCount += jobs.peJobs.length
      if (jobs.matchas) jobCount += jobs.matchas.length
      if (jobs.lbbCompanies) jobCount += jobs.lbbCompanies.length
      if (jobs.lbaCompanies) jobCount += jobs.lbaCompanies.length
    }

    return jobCount
  }

  const getJobList = () => {
    const mergedJobs = mergeJobs(props.jobs)
    if (mergedJobs.length) {
      return (
        <>
          {mergedJobs.map((job, idx) => {
            return renderJob(props.isTestMode, idx, job, props.handleSelectItem, props.searchForTrainingsOnNewCenter)
          })}
        </>
      )
    } else return ""
  }

  const getLbbCompanyList = () => {
    const mergedLbaLbbCompanies = mergeOpportunities(props.jobs, "onlyLbbLba")
    if (mergedLbaLbbCompanies.length) {
      return (
        <>
          {mergedLbaLbbCompanies.map((company, idx) => {
            return renderLbb(props.isTestMode, idx, company, props.handleSelectItem, props.searchForTrainingsOnNewCenter)
          })}
        </>
      )
    } else return ""
  }

  // retourne le bloc construit des items lbb, lba, matcha et pe triés par ordre de distance
  const getMergedJobList = () => {
    const mergedOpportunities = mergeOpportunities(props.jobs)

    if (mergedOpportunities.length) {
      return (
        <>
          {mergedOpportunities.map((opportunity, idx) => {
            if (opportunity.ideaType === "peJob" || opportunity.ideaType === "matcha") {
              return renderJob(props.isTestMode, idx, opportunity, props.handleSelectItem, props.searchForTrainingsOnNewCenter)
            } else {
              return renderLbb(props.isTestMode, idx, opportunity, props.handleSelectItem, props.searchForTrainingsOnNewCenter)
            }
          })}
        </>
      )
    } else {
      return ""
    }
  }

  // construit le bloc formaté avec les erreurs remontées
  const getErrorMessages = () => {
    return props.trainingSearchError && props.allJobSearchError ? (
      <ErrorMessage message="Erreur technique momentanée" type="column" />
    ) : (
      <>
        {props.trainingSearchError && <ErrorMessage message={props.trainingSearchError} />}
        {props.jobSearchError && <ErrorMessage message={props.jobSearchError} />}
      </>
    )
  }

  const [displayCount, setDisplayCount] = useState(true)
  const handleScroll = () => {
    setDisplayCount(document.querySelector("#resultList").scrollTop < 30)
  }

  return (
    <Flex direction="column" height={props.selectedItem ? "0%" : "100%"} display={isFormVisible ? "none" : "flex"}>
      <Box bg="beige" display={props.shouldShowWelcomeMessage || props.selectedItem ? "none" : ""}>
        <Flex flex="1 auto" my={[2, 2, 0]} alignItems="center">
          <Button
            background="none"
            border="none"
            title="Accéder aux filtrage des résultats"
            display={["flex", "flex", "none"]}
            mt="-10px"
            ml="auto"
            mr="30px"
            pt="15px"
            onClick={props.showSearchForm}
          >
            <Image width="24px" height="24px" src={purpleFilterIcon} alt="" />
          </Button>
        </Flex>
        <DisplayMapButton jobs={props.jobs} trainings={props.trainings} />
        <ResultListsCounter
          scopeContext={scopeContext}
          filterButtonClicked={filterButtonClicked}
          allJobSearchError={props.allJobSearchError}
          trainingSearchError={props.trainingSearchError}
          isJobSearchLoading={props.isJobSearchLoading}
          isTrainingSearchLoading={props.isTrainingSearchLoading}
          displayCount={displayCount}
          getJobCount={getJobCount}
          jobs={props.jobs}
          trainings={props.trainings}
          activeFilter={props.activeFilter}
        />
        {getErrorMessages()}
      </Box>
      <Box
        flex="1"
        pb={["100px", "100px", 0]}
        overflow="auto"
        onScroll={handleScroll}
        id="resultList"
        display={props.shouldShowWelcomeMessage || props.selectedItem ? "none" : ""}
        bg="beige"
      >
        {props.activeFilter !== "duo" ? (
          <>
            {getTrainingResult()}
            {getJobResult()}
          </>
        ) : (
          <DuoContainer />
        )}
      </Box>
    </Flex>
  )
}

export default ResultLists
