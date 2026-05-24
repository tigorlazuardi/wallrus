<script lang="ts">
	import { superForm } from "sveltekit-superforms/client"
	import { zod4Client as zodClient } from "sveltekit-superforms/adapters"
	import { LoginRequestSchema } from "$lib/schemas/auth/Login"

	let { data }: { data: import("./$types").PageData } = $props()

	// superForm takes the server-provided initial snapshot; it manages its own
	// internal state from that point. The Svelte 5 "initial value capture" lint
	// is a false positive here — this is the intended superforms API.
	const { form, errors, message, enhance, submitting } = superForm(data.form, {
		dataType: "json",
		validators: zodClient(LoginRequestSchema),
	})
</script>

<main class="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
	<div
		class="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--color-glass-border)] bg-[var(--color-glass)] p-8 backdrop-blur-[var(--blur)]"
	>
		<h1 class="mb-6 text-xl font-semibold tracking-tight text-[var(--color-fg)]">
			Sign in to wallrus
		</h1>

		{#if $message}
			<p class="mb-4 rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-300">
				{$message}
			</p>
		{/if}

		<form method="POST" use:enhance class="flex flex-col gap-4">
			<div class="flex flex-col gap-1">
				<label for="username" class="text-sm text-[var(--color-fg-muted)]">Username</label>
				<input
					id="username"
					name="username"
					type="text"
					autocomplete="username"
					bind:value={$form.username}
					class="rounded-[var(--radius)] border border-[var(--color-glass-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
				/>
				{#if $errors.username}
					<p class="text-xs text-red-400">{$errors.username[0]}</p>
				{/if}
			</div>

			<div class="flex flex-col gap-1">
				<label for="password" class="text-sm text-[var(--color-fg-muted)]">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					bind:value={$form.password}
					class="rounded-[var(--radius)] border border-[var(--color-glass-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
				/>
				{#if $errors.password}
					<p class="text-xs text-red-400">{$errors.password[0]}</p>
				{/if}
			</div>

			<button
				type="submit"
				disabled={$submitting}
				class="mt-2 rounded-[var(--radius)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
			>
				{$submitting ? "Signing in…" : "Sign in"}
			</button>
		</form>
	</div>
</main>
