import _ from "lodash-es"
import { sentryCaptureException } from "../../common/utils/sentryUtils.js"
import config from "../../config.js"
import updateLaBonneBoiteJob from "../../jobs/lbb/updateLaBonneBoite.js"

const updateLaBonneBoite = async (query) => {
  if (!query.secret) {
    return { error: "secret_missing" }
  } else if (query.secret !== config.secretUpdateRomesMetiers) {
    return { error: "wrong_secret" }
  } else {
    try {
      const params = {
        shouldClearMongo: query?.shouldClearMongo === "false" ? false : true,
        shouldBuildIndex: query?.shouldBuildIndex === "false" ? false : true,
        shouldParseFiles: query?.shouldParseFiles === "false" ? false : true,
        shouldInitSAVEMaps: query?.shouldInitSAVEMaps === "false" ? false : true,
        useCBSPrediction: query?.useCBSPrediction === "true" ? true : false,
      }

      console.log(params)

      const result = await updateLaBonneBoiteJob(params)
      return result
    } catch (err) {
      sentryCaptureException(err)

      const error_msg = _.get(err, "meta.body") ?? err.message

      return { error: error_msg }
    }
  }
}

export { updateLaBonneBoite }
