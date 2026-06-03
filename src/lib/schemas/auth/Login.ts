import { z } from "zod"

export const LoginRequestSchema = z.object({
	username: z.string().min(1),
	password: z.string().min(1),
})

export type LoginRequest = z.infer<typeof LoginRequestSchema>

export const LoginResponseSchema = z.object({
	access_token: z.string().min(1),
	expires_at: z.number().int().positive(),
})

export type LoginResponse = z.infer<typeof LoginResponseSchema>
