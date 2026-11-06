import type { SessionClaims } from "@razzia/common/types/auth"
import type { ApiEnv } from "@razzia/socket/api/factory"
import { verifyToken } from "@razzia/socket/services/auth"
import UserService from "@razzia/socket/services/user"
import type { Context } from "hono"
import { createMiddleware } from "hono/factory"

export const readClaims = async (
  c: Context,
): Promise<SessionClaims | undefined> => {
  const authorization = c.req.header("Authorization")

  if (!authorization?.startsWith("Bearer ")) {
    return undefined
  }

  try {
    return await verifyToken(authorization.slice(7))
  } catch {
    return undefined
  }
}

export const requireSession = createMiddleware<ApiEnv>(async (c, next) => {
  const claims = await readClaims(c)

  if (!claims) {
    return c.json({ error: "errors:auth.unauthorized" }, 401)
  }

  c.set("claims", claims)
  await next()
})

export const requireAccount = createMiddleware<ApiEnv>(async (c, next) => {
  const claims = await readClaims(c)
  const user = claims?.userId ? UserService.getUserById(claims.userId) : null

  if (!claims || !user) {
    return c.json({ error: "errors:auth.unauthorized" }, 401)
  }

  c.set("claims", claims)
  c.set("user", user)
  await next()
})

export const requireManager = createMiddleware<ApiEnv>(async (c, next) => {
  const claims = await readClaims(c)
  const user = claims?.userId ? UserService.getUserById(claims.userId) : null

  if (
    !claims ||
    !user ||
    (user.role !== "admin" && user.role !== "quizmaster")
  ) {
    return c.json({ error: "errors:auth.unauthorized" }, 403)
  }

  c.set("claims", claims)
  c.set("user", user)
  await next()
})

export const requireAdmin = createMiddleware<ApiEnv>(async (c, next) => {
  const claims = await readClaims(c)
  const user = claims?.userId ? UserService.getUserById(claims.userId) : null

  if (!claims || user?.role !== "admin") {
    return c.json({ error: "errors:auth.unauthorized" }, 403)
  }

  c.set("claims", claims)
  c.set("user", user)
  await next()
})
