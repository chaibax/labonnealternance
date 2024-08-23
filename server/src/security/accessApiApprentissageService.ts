import Boom from "boom"
import jwt from "jsonwebtoken"
import { z } from "zod"

import { logger } from "@/common/logger"
import config from "@/config"

import { sentryCaptureException } from "../common/utils/sentryUtils"

const { JsonWebTokenError, TokenExpiredError } = jwt

const jwtPublicKey = config.auth.apiApprentissage.publicKey

const ZApiApprentissageTokenData = z.object({
  email: z.string().email(),
})

export type ApiApprentissageTokenData = z.output<typeof ZApiApprentissageTokenData>

export const parseApiApprentissageToken = (jwtToken: string): ApiApprentissageTokenData => {
  try {
    const { payload } = jwt.verify(jwtToken, jwtPublicKey, {
      complete: true,
      algorithms: ["ES512"],
    })
    const parseResult = ZApiApprentissageTokenData.safeParse(payload)
    if (!parseResult.success) {
      throw Boom.forbidden("Payload doesn't match expected schema")
    }
    return parseResult.data
  } catch (err: unknown) {
    if (err instanceof TokenExpiredError) {
      const e = Boom.forbidden("JWT expired")
      e.cause = err
      throw e
    }

    if (err instanceof JsonWebTokenError) {
      logger.warn("invalid jwt token", jwtToken, err)
      const e = Boom.forbidden("Invalid JWT token")
      e.cause = err
      throw e
    }

    if (err instanceof Error && Boom.isBoom(err)) {
      sentryCaptureException(err)
      throw err
    }

    sentryCaptureException(err)
    const e = Boom.unauthorized()
    e.cause = err
    throw e
  }
}
