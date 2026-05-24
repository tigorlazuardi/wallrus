import { redirect } from "@sveltejs/kit"
import type { LayoutServerLoad } from "./$types"

export const load: LayoutServerLoad = async (event) => {
	const user = event.locals.user

	// When user is null, auth is enabled and no valid session is present.
	// Redirect to the login page, preserving the intended destination.
	if (user === null) {
		const next = encodeURIComponent(event.url.pathname + event.url.search)
		redirect(303, `/login?next=${next}`)
	}

	// user.auth_mode === "disabled" means WALLRUS_AUTH_ENABLE=false — pass through.
	return { user }
}
