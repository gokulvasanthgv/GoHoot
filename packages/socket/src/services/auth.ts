import { SESSION_ROLES } from "@razzia/common/constants"
import type {
  PublicUser,
  SessionClaims,
  SessionResponse,
  JoinTicketClaims,
} from "@razzia/common/types/auth"
import {
  sessionClaimsValidator,
  joinTicketClaimsValidator,
} from "@razzia/common/validators/auth"
import { jwtSecret } from "@razzia/socket/env"
import {
  getPath,
  isRecord,
  readJson,
  writeJson,
} from "@razzia/socket/services/storage"
import UserService from "@razzia/socket/services/user"
import { sign, verify } from "hono/jwt"
import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"

const ALGORITHM = "HS256"
const PLAYER_TTL = 60 * 60 * 24 * 30
const ACCOUNT_TTL = 60 * 60 * 12
let revocationPath = ""
let revoked: Record<string, number> = {}

const loadRevocations = (): void => {
  const path = getPath("revoked-sessions.json")

  if (revocationPath === path) {
    return
  }

  const data = readJson(path)

  if (existsSync(path) && !isRecord(data)) {
    throw new Error(
      "Unreadable session revocations; refusing to accept possibly revoked sessions",
    )
  }

  revoked = isRecord(data)
    ? Object.fromEntries(
        Object.entries(data).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === "number" && entry[1] > Date.now() / 1000,
        ),
      )
    : {}
  revocationPath = path
}

export const newClientId = (): string => randomUUID()

export const isClaimsActive = (
  claims: SessionClaims,
  ignoreExpiry = false,
): boolean => {
  loadRevocations()

  if (
    (!ignoreExpiry && claims.exp <= Math.floor(Date.now() / 1000)) ||
    Object.hasOwn(revoked, claims.jti)
  ) {
    return false
  }

  if (!claims.userId) {
    return claims.role === SESSION_ROLES.PLAYER
  }

  return (
    UserService.getSessionVersion(claims.userId) === claims.sessionVersion &&
    UserService.getUserById(claims.userId) !== null
  )
}

export const mintToken = async (
  sub: string,
  user?: PublicUser | null,
): Promise<SessionResponse> => {
  const iat = Math.floor(Date.now() / 1000)
  const role =
    user && (user.role === "admin" || user.role === "quizmaster")
      ? SESSION_ROLES.MANAGER
      : SESSION_ROLES.PLAYER
  const claims: SessionClaims = {
    sub,
    role,
    iat,
    exp: iat + (user ? ACCOUNT_TTL : PLAYER_TTL),
    jti: randomUUID(),
    purpose: "session",
    ...(user
      ? {
          userId: user.id,
          sessionVersion: UserService.getSessionVersion(user.id),
        }
      : {}),
  }

  return {
    token: await sign({ ...claims }, jwtSecret, ALGORITHM),
    clientId: sub,
    role,
    expiresAt: claims.exp,
    user: user ?? null,
  }
}

export const verifyToken = async (token: string): Promise<SessionClaims> => {
  const claims = sessionClaimsValidator.parse(
    await verify(token, jwtSecret, ALGORITHM),
  )

  if (!isClaimsActive(claims)) {
    throw new Error("Invalid or revoked session")
  }

  return claims
}

export const verifyIgnoringExpiry = async (
  token: string,
): Promise<SessionClaims> => {
  const claims = sessionClaimsValidator.parse(
    await verify(token, jwtSecret, { alg: ALGORITHM, exp: false }),
  )

  if (!isClaimsActive(claims, true)) {
    throw new Error("Revoked session")
  }

  return claims
}

export const sessionResponse = (
  token: string,
  claims: SessionClaims,
): SessionResponse => ({
  token,
  clientId: claims.sub,
  role: claims.role,
  expiresAt: claims.exp,
  user: claims.userId ? UserService.getUserById(claims.userId) : null,
})

export const revokeToken = (claims: SessionClaims): void => {
  loadRevocations()
  revoked = Object.fromEntries(
    Object.entries(revoked).filter(([, expiry]) => expiry > Date.now() / 1000),
  )
  revoked[claims.jti] = claims.exp
  writeJson(getPath("revoked-sessions.json"), revoked)
}

export const mintJoinTicket = (
  sub: string,
  gameId: string,
  username?: string,
): Promise<string> => {
  const iat = Math.floor(Date.now() / 1000)

  return sign(
    { sub, gameId, username, iat, exp: iat + 300, purpose: "join" },
    jwtSecret,
    ALGORITHM,
  )
}

export const verifyJoinTicket = async (
  ticket: string,
): Promise<JoinTicketClaims> =>
  joinTicketClaimsValidator.parse(await verify(ticket, jwtSecret, ALGORITHM))
