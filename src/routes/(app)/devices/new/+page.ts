import type { PageLoad } from "./$types"
import { superValidate } from "sveltekit-superforms"
import { zod4 as zod } from "sveltekit-superforms/adapters"
import { CreateDeviceRequestSchema } from "$lib/schemas/devices/CreateDevice"

export const load: PageLoad = async () => {
	const form = await superValidate(zod(CreateDeviceRequestSchema))
	return { form }
}
