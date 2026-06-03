import { z } from "zod"

export const AuthStatusSchema = z.object({
	auth_enabled: z.boolean(),
})

export type AuthStatus = z.infer<typeof AuthStatusSchema>
