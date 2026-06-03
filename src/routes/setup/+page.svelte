<script lang="ts">
	import { goto } from "$app/navigation"
	import { Preferences } from "@capacitor/preferences"
	import { set_api_base } from "$lib/client/config"
	import { useAuthMutation } from "$lib/client/auth/use-auth-mutation.svelte"
	import { AuthStatusSchema } from "$lib/schemas/auth/AuthStatus"

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------

	let url = $state("")
	let username = $state("")
	let password = $state("")

	type Phase = "url" | "auth" | "done"
	let phase = $state<Phase>("url")

	let testing = $state(false)
	let logging_in = $state(false)
	let connection_error = $state<string | null>(null)
	let login_error = $state<string | null>(null)

	const { login } = useAuthMutation()

	// ---------------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------------

	function normalise_url(raw: string): string {
		return raw.trim().replace(/\/$/, "")
	}

	// ---------------------------------------------------------------------------
	// Step 1: Test connection
	// ---------------------------------------------------------------------------

	async function test_connection() {
		const base = normalise_url(url)
		if (!base) {
			connection_error = "Please enter a URL."
			return
		}

		testing = true
		connection_error = null

		try {
			// 1a. Health check
			const health_res = await fetch(`${base}/healthz`)
			if (!health_res.ok) {
				connection_error = `Server responded ${health_res.status}. Is this the right URL?`
				return
			}

			// 1b. Auth status
			const status_res = await fetch(`${base}/api/v1/auth/status`)
			if (!status_res.ok) {
				connection_error = `Auth status check failed (${status_res.status}).`
				return
			}

			const status = AuthStatusSchema.parse(await status_res.json())

			if (status.auth_enabled) {
				// Reveal credentials form.
				phase = "auth"
			} else {
				// No auth — save and navigate.
				await save_and_navigate(base)
			}
		} catch (err) {
			connection_error =
				err instanceof Error
					? `Connection failed: ${err.message}`
					: "Connection failed. Check the URL and try again."
		} finally {
			testing = false
		}
	}

	// ---------------------------------------------------------------------------
	// Step 2: Login (auth_enabled path only)
	// ---------------------------------------------------------------------------

	async function submit_login() {
		const base = normalise_url(url)
		logging_in = true
		login_error = null

		try {
			// Point at the target daemon temporarily so the login call resolves there.
			set_api_base(base)
			await login(username, password)
			await save_and_navigate(base)
		} catch (err) {
			// Reset api_base on failure so we don't leave a bad base in place.
			set_api_base("")
			login_error =
				err instanceof Error ? err.message : "Login failed. Check your credentials."
		} finally {
			logging_in = false
		}
	}

	// ---------------------------------------------------------------------------
	// Save preferences + navigate
	// ---------------------------------------------------------------------------

	async function save_and_navigate(base: string) {
		set_api_base(base)
		await Preferences.set({ key: "api_base", value: base })
		phase = "done"
		await goto("/")
	}
</script>

<main class="flex min-h-screen flex-col items-center justify-center p-6">
	<div
		class="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--color-glass-border)] bg-[var(--color-bg-elev)] p-8 shadow-lg"
	>
		<h1 class="mb-2 text-2xl font-semibold text-[var(--color-fg)]">wallrus setup</h1>
		<p class="mb-6 text-sm text-[var(--color-fg-muted)]">
			Enter the address of your wallrus daemon.
		</p>

		<!-- Step 1: URL + Test connection -->
		<div class="space-y-4">
			<div>
				<label
					for="daemon-url"
					class="mb-1 block text-sm font-medium text-[var(--color-fg)]"
				>
					Daemon URL
				</label>
				<input
					id="daemon-url"
					type="url"
					bind:value={url}
					placeholder="http://192.168.1.100:5173"
					disabled={phase === "auth" || testing}
					class="w-full rounded-[var(--radius)] border border-[var(--color-glass-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-fg-muted)] outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50"
				/>
			</div>

			{#if connection_error}
				<p class="text-sm text-red-500" role="alert">{connection_error}</p>
			{/if}

			{#if phase === "url"}
				<button
					onclick={test_connection}
					disabled={testing || !url}
					class="w-full rounded-[var(--radius)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{testing ? "Testing…" : "Test connection"}
				</button>
			{/if}
		</div>

		<!-- Step 2: Credentials (auth_enabled path) -->
		{#if phase === "auth"}
			<div class="mt-6 space-y-4 border-t border-[var(--color-glass-border)] pt-6">
				<p class="text-sm text-[var(--color-fg-muted)]">
					This daemon requires authentication.
				</p>

				<div>
					<label
						for="username"
						class="mb-1 block text-sm font-medium text-[var(--color-fg)]"
					>
						Username
					</label>
					<input
						id="username"
						type="text"
						autocomplete="username"
						bind:value={username}
						disabled={logging_in}
						class="w-full rounded-[var(--radius)] border border-[var(--color-glass-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-fg-muted)] outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50"
					/>
				</div>

				<div>
					<label
						for="password"
						class="mb-1 block text-sm font-medium text-[var(--color-fg)]"
					>
						Password
					</label>
					<input
						id="password"
						type="password"
						autocomplete="current-password"
						bind:value={password}
						disabled={logging_in}
						class="w-full rounded-[var(--radius)] border border-[var(--color-glass-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-fg-muted)] outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50"
					/>
				</div>

				{#if login_error}
					<p class="text-sm text-red-500" role="alert">{login_error}</p>
				{/if}

				<button
					onclick={submit_login}
					disabled={logging_in || !username || !password}
					class="w-full rounded-[var(--radius)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{logging_in ? "Signing in…" : "Sign in"}
				</button>

				<button
					onclick={() => {
						phase = "url"
						connection_error = null
						login_error = null
					}}
					class="w-full rounded-[var(--radius)] px-4 py-2 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
				>
					Back
				</button>
			</div>
		{/if}
	</div>
</main>
