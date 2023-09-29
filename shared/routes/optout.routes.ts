import { z } from "zod"

import { IRoutesDef } from "./common.routes"

export const zOptoutRoutes = {
  get: {
    "/optout/validate": {
      // TODO_SECURITY_FIX jwt
      // jwt auth
      response: {
        "200": z.union([
          z.object({ error: z.boolean(), reason: z.string() }).strict(),
          z
            .object({
              etat: z.string().describe("Etat administratif de l'organisme de formation"),
              uai: z.array(z.string()).describe("UAI potentiel de l'organisme de formation"),
              rue: z.string().describe("Rue de l'organisme de formation"),
              code_postal: z.string().describe("Code postal de l'organisme de formation"),
              commune: z.string().describe("Commune de l'organisme de formation"),
              siret: z.string().describe("Numéro SIRET de l'organisme de formation"),
              contacts: z
                .array(
                  z
                    .object({
                      email: z.string().email(),
                      confirmé: z.boolean(),
                      sources: z.array(z.string()),
                    })
                    .strict()
                )
                .describe("liste des contacts"),
              qualiopi: z.boolean().describe("Certification QUALIOPI"),
              raison_sociale: z.string().nullable().describe("Raison social de l'entreprise"),
              adresse: z.string().nullable().describe("Adresse de l'entreprise"),
              geo_coordonnees: z.string().nullable().describe("Latitude/Longitude (inversion lié à LBA) de l'adresse de l'entreprise"),
              mail: z
                .array(
                  z
                    .object({
                      email: z.string(),
                      messageId: z.string(),
                      date: z.date(),
                    })
                    .strict()
                )
                .describe("Interaction avec les contacts"),
              user_id: z.string().describe("Identifiant mongoDB de l'utilisateur, si il existe dans la collection User"),
              email: z.string().email(),
            })
            .strict(),
        ]),
        "401": z
          .object({
            error: z.boolean(),
            reason: z.string(),
          })
          .strict(),
      },
      securityScheme: {
        auth: "jwt-password",
        role: "all",
      },
    },
  },
} as const satisfies IRoutesDef
