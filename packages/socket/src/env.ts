import { randomBytes } from "node:crypto"
import { z } from "zod"

const optional = (schema: z.ZodString) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional())
const parsed = z
  .object({
    MANAGER_PASSWORD: optional(z.string().min(8).max(256)),
    JWT_SECRET: optional(z.string().min(32)),
    GAME_SPEED: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.coerce.number().positive().default(1),
    ),
    SOCKET_PORT: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.coerce.number().int().min(1).max(65535).default(3001),
    ),
    ALLOW_SIGNUP: z.enum(["true", "false"]).default("true"),
    TRUST_PROXY: z.enum(["true", "false"]).default("false"),
  })
  .safeParse(process.env)

if (!parsed.success) {
  throw new Error(
    `Invalid environment: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
  )
}

export const managerPassword = parsed.data.MANAGER_PASSWORD

export const jwtSecret =
  parsed.data.JWT_SECRET ?? randomBytes(32).toString("hex")

export const gameSpeed = parsed.data.GAME_SPEED

export const socketPort = parsed.data.SOCKET_PORT

export const allowSignup = parsed.data.ALLOW_SIGNUP === "true"

export const trustProxy = parsed.data.TRUST_PROXY === "true"
