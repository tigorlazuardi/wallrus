<script lang="ts">
	import type { PageData } from "./$types"
	import SubscriptionForm from "$lib/components/SubscriptionForm.svelte"
	import type { ParamDescriptor } from "$lib/components/SubscriptionForm.types"

	let { data }: { data: PageData } = $props()

	// Form state
	let source_slug = $state("")
	let name = $state("")
	let input_params = $state<Record<string, unknown>>({})
	let cron = $state("0 * * * *")
	let max_items_inspected = $state<number | null>(null)
	let enabled = $state(true)
	let linked_device_ids = $state<string[]>([])

	let submitting = $state(false)
	let error = $state<string | null>(null)
	let field_errors = $state<Record<string, string | string[]>>({})

	// Compute param descriptors for the currently selected source
	const param_descriptors = $derived((): ParamDescriptor[] => {
		const src = data.sources.find((s) => s.slug === source_slug)
		return (src?.param_descriptors ?? []) as ParamDescriptor[]
	})

	// Reset params when source changes
	$effect(() => {
		// Reactive on source_slug — clear params to avoid stale values
		void source_slug
		input_params = {}
	})

	async function handle_submit(e: SubmitEvent): Promise<void> {
		e.preventDefault()
		submitting = true
		error = null
		field_errors = {}

		try {
			const res = await fetch("?/default", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					source_slug,
					name,
					input_params,
					cron,
					max_items_inspected,
					enabled,
					linked_device_ids,
				}),
			})

			if (res.redirected) {
				window.location.href = res.url
				return
			}

			if (!res.ok) {
				const body = await res.json()
				// SvelteKit form failure wraps data in { type: "failure", status, data: { ... } }
				const result_data = (
					body as {
						data?: { errors?: Record<string, string | string[]>; error?: string }
					}
				)?.data
				field_errors = result_data?.errors ?? {}
				error = result_data?.error ?? `Unexpected error (${res.status}).`
			}
		} catch {
			error = "Network error. Please check your connection and try again."
		} finally {
			submitting = false
		}
	}
</script>

<svelte:head>
	<title>New subscription — wallrus</title>
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-8">
	<div class="mb-6 flex items-center gap-3">
		<a
			href="/subscriptions"
			class="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
		>
			&larr; Subscriptions
		</a>
		<h1 class="text-2xl font-bold text-[var(--color-fg)]">New subscription</h1>
	</div>

	{#if error}
		<div
			class="mb-4 rounded-[var(--radius)] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
		>
			{error}
		</div>
	{/if}

	<form onsubmit={handle_submit}>
		<SubscriptionForm
			sources={data.sources}
			devices={data.devices}
			param_descriptors={param_descriptors()}
			bind:source_slug
			bind:name
			bind:input_params
			bind:cron
			bind:max_items_inspected
			bind:enabled
			bind:linked_device_ids
			errors={field_errors}
			{submitting}
			submit_label="Create subscription"
			show_source_select={true}
		>
			{#snippet cancel()}
				<a
					href="/subscriptions"
					class="inline-flex h-9 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-surface-hi)]"
					style="border-color: var(--color-glass-border);"
				>
					Cancel
				</a>
			{/snippet}
		</SubscriptionForm>
	</form>
</div>
