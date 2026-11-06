import type { SessionClaims, PublicUser } from "@razzia/common/types/auth"
import { createFactory } from "hono/factory"

export interface ApiEnv {
  Variables: {
    claims: SessionClaims
    user: PublicUser
  }
}

export const apiFactory = createFactory<ApiEnv>()
