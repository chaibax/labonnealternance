import _ from "lodash-es"
import { sentryCaptureException } from "../../common/utils/sentryUtils.js"
import config from "../../config.js"
import updateOpcoJob from "../../jobs/lbb/updateOpcoCompanies.js"

const updateOpcos = async (query) => {
  if (!query.secret) {
    return { error: "secret_missing" }
  } else if (query.secret !== config.secretUpdateRomesMetiers) {
    return { error: "wrong_secret" }
  } else {
    try {
      const result = await updateOpcoJob()
      return result
    } catch (err) {
      sentryCaptureException(err)
      const error_msg = _.get(err, "meta.body") ?? err.message
      return { error: error_msg }
    }
  }
}

export { updateOpcos }
