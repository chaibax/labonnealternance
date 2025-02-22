import { z } from "zod"

import { extensions } from "../helpers/zodHelpers/zodPrimitives"

import { IModelDescriptor } from "./common"
import { ZJobsPartnersOfferPrivate } from "./jobsPartners.model"

const collectionName = "computed_jobs_partners" as const

export enum COMPUTED_ERROR_SOURCE {
  API_SIRET = "api_siret",
  API_OPCO = "api_opco",
  API_ADRESSE = "api_adresse",
  API_ROMEO = "api_romeo",
  VALIDATION = "validation",
}

export const ZComputedJobsPartners = extensions.optionalToNullish(ZJobsPartnersOfferPrivate.partial()).extend({
  errors: z.array(
    z
      .object({
        source: extensions.buildEnum(COMPUTED_ERROR_SOURCE),
        error: z.string(),
      })
      .nullable()
      .describe("Détail des erreurs rencontrées lors de la récupération des données obligatoires")
  ),
  validated: z.boolean().default(false).describe("Toutes les données nécessaires au passage vers jobs_partners sont présentes et valides"),
})
export type IComputedJobsPartners = z.output<typeof ZComputedJobsPartners>

export default {
  zod: ZComputedJobsPartners,
  indexes: [
    [{ partner_job_id: 1 }, {}],
    [{ partner_label: 1 }, {}],
    [{ validated: 1 }, {}],
    [{ errors: 1 }, {}],
    [{ partner_label: 1, partner_job_id: 1 }, { unique: true }],
  ],
  collectionName,
} as const satisfies IModelDescriptor
