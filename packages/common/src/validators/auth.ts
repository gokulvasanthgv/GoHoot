import {
  MIN_PASSWORD_LENGTH,
  SESSION_ROLES,
  USER_ROLES,
} from "@razzia/common/constants"
import z from "zod"

export const usernameValidator = z
  .string()
  .trim()
  .min(1, "errors:auth.usernameTooShort")
  .max(20, "errors:auth.usernameTooLong")
  .refine(
    // oxlint-disable-next-line no-control-regex -- Reject control characters in account names.
    (value) => !/[\u0000-\u001f\u007f]/u.test(value),
    "errors:auth.invalidInput",
  )

export const inviteCodeValidator = z
  .string()
  .length(6, "errors:auth.invalidInviteCode")
  .regex(/^\d{6}$/u, "errors:auth.invalidInviteCode")

export const accountUsernameValidator = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(
    // oxlint-disable-next-line no-control-regex -- Reject control characters in account names.
    (value) => !/[\u0000-\u001f\u007f]/u.test(value),
    "errors:auth.invalidInput",
  )

export const passwordValidator = z
  .string()
  .min(MIN_PASSWORD_LENGTH, "errors:auth.passwordTooShort")
  .max(256)

export const signInValidator = z.object({
  username: accountUsernameValidator,
  password: z.string().min(1).max(256),
})

export const signUpValidator = signInValidator.extend({
  password: passwordValidator,
})

export const managerLoginValidator = z.object({
  password: z.string().min(1).max(256),
})

export const sessionRequestValidator = z.object({
  token: z.string().max(4096).optional(),
})

export const roleValidator = z.enum(USER_ROLES)

export const changePasswordValidator = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: passwordValidator,
})

export const adminResetPasswordValidator = z.object({
  userId: z.string().min(1).max(128),
  newPassword: passwordValidator,
})

export const sessionClaimsValidator = z.object({
  sub: z.string().min(1).max(128),
  role: z.enum([SESSION_ROLES.PLAYER, SESSION_ROLES.MANAGER]),
  iat: z.number().int(),
  exp: z.number().int(),
  jti: z.string().min(1).max(128),
  purpose: z.literal("session"),
  userId: z.string().min(1).max(128).optional(),
  sessionVersion: z.number().int().nonnegative().optional(),
})

export const joinTicketClaimsValidator = z.object({
  sub: z.string().min(1).max(128),
  gameId: z.string().min(1).max(128),
  username: usernameValidator.optional(),
  iat: z.number().int(),
  exp: z.number().int(),
  purpose: z.literal("join"),
})
