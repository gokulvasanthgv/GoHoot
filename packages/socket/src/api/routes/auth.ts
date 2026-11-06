import { zValidator } from "@hono/zod-validator"
import {
  adminResetPasswordValidator,
  accountUsernameValidator,
  changePasswordValidator,
  managerLoginValidator,
  roleValidator,
  sessionRequestValidator,
  signInValidator,
  signUpValidator,
} from "@razzia/common/validators/auth"
import { apiFactory } from "@razzia/socket/api/factory"
import {
  readClaims,
  requireAccount,
  requireAdmin,
} from "@razzia/socket/api/middleware"
import { i18nHook } from "@razzia/socket/api/validation"
import { allowSignup, trustProxy } from "@razzia/socket/env"
import {
  mintToken,
  newClientId,
  revokeToken,
  sessionResponse,
  verifyIgnoringExpiry,
  verifyToken,
} from "@razzia/socket/services/auth"
import {
  disconnectUserSessions,
  notifyAdmins,
} from "@razzia/socket/services/notifications"
import { consumeLimit } from "@razzia/socket/services/rate-limit"
import UserService from "@razzia/socket/services/user"
import { getConnInfo } from "@hono/node-server/conninfo"
import { z } from "zod"
import type { Context } from "hono"

const ip = (c: Context): string => {
  if (trustProxy) {
    return c.req.header("X-Real-IP") ?? "unknown"
  }

  try {
    return getConnInfo(c).remote.address ?? "unknown"
  } catch {
    return "local"
  }
}
const authLimit = (c: Context, username = "") =>
  consumeLimit(`auth-ip:${ip(c)}`, 30, 15 * 60_000) &&
  consumeLimit(
    `auth-account:${ip(c)}:${username.toLowerCase()}`,
    10,
    15 * 60_000,
  )

export const auth = apiFactory
  .createApp()
  .post(
    "/session",
    zValidator("json", sessionRequestValidator, i18nHook),
    async (c) => {
      const token =
        c.req.valid("json").token ??
        c.req.header("Authorization")?.replace(/^Bearer /u, "")

      if (token) {
        try {
          return c.json(sessionResponse(token, await verifyToken(token)))
        } catch {
          try {
            const claims = await verifyIgnoringExpiry(token)

            return c.json(await mintToken(claims.sub))
          } catch {
            /* Invalid identity gets a fresh guest session. */
          }
        }
      }

      return c.json(await mintToken(newClientId()))
    },
  )
  .post("/signin", zValidator("json", signInValidator, i18nHook), async (c) => {
    const { username, password } = c.req.valid("json")

    if (!authLimit(c, username)) {
      return c.json({ error: "errors:auth.rateLimited" }, 429)
    }

    const result = await UserService.signIn(username, password)

    if (!result.success) {
      return c.json({ error: result.error }, 403)
    }

    const previous = await readClaims(c)

    if (previous) {
      revokeToken(previous)
    }

    return c.json(await mintToken(previous?.sub ?? newClientId(), result.user))
  })
  .post("/signup", zValidator("json", signUpValidator, i18nHook), async (c) => {
    if (!allowSignup) {
      return c.json({ error: "errors:auth.signupDisabled" }, 403)
    }

    if (!authLimit(c) || !consumeLimit(`signup:${ip(c)}`, 5, 60 * 60_000)) {
      return c.json({ error: "errors:auth.rateLimited" }, 429)
    }

    const { username, password } = c.req.valid("json")
    const result = await UserService.signUp(username, password)

    if (!result.success) {
      return c.json({ error: result.error }, 400)
    }

    const previous = await readClaims(c)

    if (previous) {
      revokeToken(previous)
    }

    return c.json(
      await mintToken(previous?.sub ?? newClientId(), result.user),
      201,
    )
  })
  .post(
    "/manager",
    zValidator("json", managerLoginValidator, i18nHook),
    async (c) => {
      if (!authLimit(c, "admin")) {
        return c.json({ error: "errors:auth.rateLimited" }, 429)
      }

      const result = await UserService.signIn(
        "admin",
        c.req.valid("json").password,
      )

      if (!result.success) {
        return c.json({ error: result.error }, 403)
      }

      const previous = await readClaims(c)

      if (previous) {
        revokeToken(previous)
      }

      return c.json(
        await mintToken(previous?.sub ?? newClientId(), result.user),
      )
    },
  )
  .get("/me", requireAccount, (c) =>
    c.json({ user: UserService.getUserById(c.get("user").id) }),
  )
  .post("/logout", requireAccount, async (c) => {
    const claims = c.get("claims")
    revokeToken(claims)

    return c.json(await mintToken(claims.sub))
  })
  .post(
    "/password",
    requireAccount,
    zValidator("json", changePasswordValidator, i18nHook),
    async (c) => {
      if (!authLimit(c)) {
        return c.json({ error: "errors:auth.rateLimited" }, 429)
      }

      const claims = c.get("claims")
      const { currentPassword, newPassword } = c.req.valid("json")
      const result = await UserService.changePassword(
        c.get("user").id,
        currentPassword,
        newPassword,
      )

      if (!result.success) {
        return c.json({ error: result.error }, 403)
      }

      disconnectUserSessions(c.get("user").id)

      return c.json(
        await mintToken(claims.sub, UserService.getUserById(c.get("user").id)),
      )
    },
  )
  .post(
    "/forgot-password",
    zValidator(
      "json",
      z.object({ username: accountUsernameValidator }),
      i18nHook,
    ),
    (c) => {
      if (!authLimit(c)) {
        return c.json({ error: "errors:auth.rateLimited" }, 429)
      }

      UserService.requestPasswordReset(c.req.valid("json").username)
      notifyAdmins()

      return c.json({ success: true })
    },
  )

export const users = apiFactory
  .createApp()
  .use(requireAdmin)
  .get("/", (c) => c.json({ users: UserService.getAllUsers() }))
  .patch(
    "/:id/role",
    zValidator("json", z.object({ role: roleValidator }), i18nHook),
    (c) => {
      const id = c.req.param("id")

      if (
        id === c.get("claims").userId ||
        !UserService.updateUserRole(id, c.req.valid("json").role)
      ) {
        return c.json({ error: "errors:auth.unauthorized" }, 403)
      }

      disconnectUserSessions(id)

      return c.json({ user: UserService.getUserById(id) })
    },
  )
  .delete("/:id", (c) => {
    if (
      c.req.param("id") === c.get("claims").userId ||
      !UserService.deleteUser(c.req.param("id"))
    ) {
      return c.json({ error: "errors:auth.unauthorized" }, 403)
    }

    disconnectUserSessions(c.req.param("id"))

    return c.body(null, 204)
  })
  .post(
    "/:id/password",
    zValidator(
      "json",
      adminResetPasswordValidator.omit({ userId: true }),
      i18nHook,
    ),
    async (c) => {
      const user = UserService.getUserById(c.req.param("id"))

      if (
        !user ||
        !(await UserService.adminChangePassword(
          user.id,
          c.req.valid("json").newPassword,
        ))
      ) {
        return c.json({ error: "errors:auth.userNotFound" }, 404)
      }

      disconnectUserSessions(user.id)
      for (const request of UserService.getForgotPasswordRequests()) {
        if (request.username.toLowerCase() === user.username.toLowerCase()) {
          UserService.dismissPasswordReset(request.id)
        }
      }
      notifyAdmins()

      return c.json({ success: true })
    },
  )
  .delete("/notifications/:id", (c) => {
    UserService.dismissPasswordReset(c.req.param("id"))
    notifyAdmins()

    return c.body(null, 204)
  })
