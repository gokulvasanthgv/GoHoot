import type { SESSION_ROLES, USER_ROLES } from "@razzia/common/constants"

export type SessionRole = (typeof SESSION_ROLES)[keyof typeof SESSION_ROLES]

export type UserRole = (typeof USER_ROLES)[number]

export interface PublicUser {
  id: string
  username: string
  role: UserRole
  createdAt: string
}

export interface PasswordResetRequest {
  id: string
  username: string
  createdAt: string
}

export interface SessionClaims {
  sub: string
  role: SessionRole
  iat: number
  exp: number
  jti: string
  purpose: "session"
  userId?: string
  sessionVersion?: number
}

export interface SessionResponse {
  token: string
  clientId: string
  role: SessionRole
  expiresAt: number
  user: PublicUser | null
}

export interface JoinTicketClaims {
  sub: string
  gameId: string
  username?: string
  iat: number
  exp: number
  purpose: "join"
}
