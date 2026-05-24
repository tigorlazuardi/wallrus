import { redirect } from "@sveltejs/kit"
import { superValidate, message } from "sveltekit-superforms"
import { fail } from "@sveltejs/kit"
import { zod4 as zod } from "sveltekit-superforms/adapters"
import type { Actions, PageServerLoad } from "./$types"
import { LoginRequestSchema } from "$lib/schemas/auth/Login"
import { env } from "$lib/server/env"
import { is_locked, record_failure, reset } from "$lib/server/auth/rate-limit"
import { verify_password } from "$lib/server/auth/password"
import { sign_session } from "$lib/server/auth/jwt"
import { set_session_cookie } from "$lib/server/auth/cookie"

export const load: PageServerLoad = async ({ locals, url }) => {
	// Already authenticated → skip login page.
	if (locals.user !== null) {
		const next = url.searchParams.get("next") ?? "/"
		redirect(303, next)
	}

	const form = await superValidate(zod(LoginRequestSchema))
	return { form }
}

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod(LoginRequestSchema))
		if (!form.valid) return fail(400, { form })

		// Rate-limit by IP.
		let ip: string
		try {
			ip = event.getClientAddress()
		} catch {
			ip = "unknown"
		}

		if (is_locked(ip)) {
			return message(form, "Too many failed attempts. Try again later.", { status: 429 })
		}

		const e = env()

		// Auth disabled → just redirect.
		if (!e.WALLRUS_AUTH_ENABLE) {
			const next = event.url.searchParams.get("next") ?? "/"
			redirect(303, next)
		}

		const { username, password } = form.data

		const expected_username = e.WALLRUS_USERNAME ?? ""
		const username_ok = username === expected_username
		const hash = e.password_hash ?? ""
		const password_ok = hash ? await verify_password(password, hash) : false

		if (!username_ok || !password_ok) {
			record_failure(ip)
			return message(form, "Invalid credentials.", { status: 401 })
		}

		reset(ip)
		const token = await sign_session({ username, secret: e.WALLRUS_AUTH_SECRET! })
		set_session_cookie(event, token)

		const next = event.url.searchParams.get("next") ?? "/"
		redirect(303, next)
	},
}
