import { z } from "zod"

export const DeleteDeviceRequestSchema = z.object({
	id: z.string().uuid(),
})

export type DeleteDeviceRequest = z.infer<typeof DeleteDeviceRequestSchema>

/** Hard delete returns no body (204 at HTTP layer). */
export const DeleteDeviceResponseSchema = z.void()

export type DeleteDeviceResponse = z.infer<typeof DeleteDeviceResponseSchema>
