<script lang="ts">
	import { untrack } from "svelte"
	import { enhance } from "$app/forms"
	import type { PageData } from "./$types"
	import SubscriptionForm from "$lib/components/SubscriptionForm.svelte"
	import type { ParamDescriptor } from "$lib/components/SubscriptionForm.types"

	let { data }: { data: PageData } = $props()

	// Edit form state (initialized from subscription data).
	// Use untrack() to avoid Svelte 5 state_referenced_locally warning.
	let editing = $state(false)
	let name = $state(untrack(() => data.subscription.name))
	let input_params = $state<Record<string, unknown>>(
		untrack(() => (data.subscription.input_params ?? {}) as Record<string, unknown>),
	)
	let cron = $state(untrack(() => data.subscription.cron))
	let max_items_inspected = $state<number | null>(
		untrack(() => data.subscription.max_items_inspected),
	)
	let enabled = $state(untrack(() => data.subscription.enabled))
	let linked_device_ids = $state<string[]>(untrack(() => data.linked_device_ids.slice()))

	let submitting = $state(false)
	let save_error = $state<string | null>(null)
	let field_errors = $state<Record<string, string | string[]>>({})

	const param_descriptors = $derived((): ParamDescriptor[] => {
		return data.param_descriptors as ParamDescriptor[]
	})

	function format_date(ms: number): string {
		return new Date(ms).toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		})
	}

	async function handle_save(e: SubmitEvent): Promise<void> {
		e.preventDefault()
		submitting = true
		save_error = null
		field_errors = {}

		try {
			const res = await fetch(`?/update`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name,
					input_params,
					cron,
					max_items_inspected,
					linked_device_ids,
				}),
			})

			if (res.redirected) {
				window.location.href = res.url
				return
			}

			if (!res.ok) {
				const body = await res.json()
				const data_body = (
					body as { data?: { errors?: Record<string, string | string[]> } }
				)?.data
				field_errors = data_body?.errors ?? {}
				save_error = "Validation failed. Please check the fields below."
			} else {
				// Refresh to show updated data
				window.location.reload()
			}
		} catch {
			save_error = "Network error. Please try again."
		} finally {
			submitting = false
		}
	}
</script>

<svelte:head>
	<title>{data.subscription.name} — wallrus</title>
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-8">
	<!-- Breadcrumb -->
	<div class="mb-6 flex items-center gap-2 text-sm text-[var(--color-fg-muted)]">
		<a href="/subscriptions" class="hover:text-[var(--color-fg)]">Subscriptions</a>
		<span>/</span>
		<span class="text-[var(--color-fg)]">{data.subscription.name}</span>
	</div>

	<div class="mb-6 flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-[var(--color-fg)]">{data.subscription.name}</h1>
			<p class="mt-1 text-sm text-[var(--color-fg-muted)]">
				Source: <strong class="text-[var(--color-fg)]"
					>{data.subscription.source_slug}</strong
				>
			</p>
		</div>
		<div class="flex gap-2">
			<form method="POST" use:enhance action="?/toggle">
				<button
					type="submit"
					class="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors {data
						.subscription.enabled
						? 'border-[var(--color-glass-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:bg-[var(--color-surface-hi)]'
						: 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:opacity-90'}"
				>
					{data.subscription.enabled ? "Disable" : "Enable"}
				</button>
			</form>

			<button
				type="button"
				onclick={() => (editing = !editing)}
				class="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors {editing
					? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
					: 'border-[var(--color-glass-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:bg-[var(--color-surface-hi)]'}"
			>
				{editing ? "Cancel edit" : "Edit"}
			</button>

			<form method="POST" use:enhance action="?/delete">
				<button
					type="submit"
					onclick={(e) => {
						if (!confirm("Delete this subscription? This is a soft delete."))
							e.preventDefault()
					}}
					class="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
				>
					Delete
				</button>
			</form>
		</div>
	</div>

	{#if data.subscription.deleted_at}
		<div
			class="mb-4 rounded-[var(--radius)] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
		>
			This subscription was deleted on {format_date(data.subscription.deleted_at)}.
		</div>
	{/if}

	{#if !editing}
		<!-- Read-only view -->
		<div class="space-y-4">
			<div
				class="rounded-[var(--radius-card)] border border-[var(--color-glass-border)] bg-[var(--color-bg-elev)] p-4"
			>
				<dl class="space-y-3 text-sm">
					<div class="flex justify-between">
						<dt class="text-[var(--color-fg-muted)]">Status</dt>
						<dd
							class="font-medium {data.subscription.enabled
								? 'text-green-400'
								: 'text-[var(--color-fg-muted)]'}"
						>
							{data.subscription.enabled ? "Enabled" : "Disabled"}
						</dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-[var(--color-fg-muted)]">Schedule</dt>
						<dd class="font-mono text-[var(--color-fg)]">{data.subscription.cron}</dd>
					</div>
					{#if data.subscription.max_items_inspected}
						<div class="flex justify-between">
							<dt class="text-[var(--color-fg-muted)]">Max items</dt>
							<dd class="text-[var(--color-fg)]">
								{data.subscription.max_items_inspected}
							</dd>
						</div>
					{/if}
					<div class="flex justify-between">
						<dt class="text-[var(--color-fg-muted)]">Created</dt>
						<dd class="text-[var(--color-fg)]">
							{format_date(data.subscription.created_at)}
						</dd>
					</div>
				</dl>
			</div>

			{#if Object.keys(data.subscription.input_params ?? {}).length > 0}
				<div
					class="rounded-[var(--radius-card)] border border-[var(--color-glass-border)] bg-[var(--color-bg-elev)] p-4"
				>
					<h2 class="mb-3 text-sm font-semibold text-[var(--color-fg)]">
						Source parameters
					</h2>
					<dl class="space-y-2 text-sm">
						{#each Object.entries(data.subscription.input_params ?? {}) as [key, val] (key)}
							<div class="flex justify-between gap-4">
								<dt class="text-[var(--color-fg-muted)]">{key}</dt>
								<dd class="truncate font-mono text-xs text-[var(--color-fg)]">
									{Array.isArray(val) ? val.join(", ") : String(val)}
								</dd>
							</div>
						{/each}
					</dl>
				</div>
			{/if}

			{#if data.linked_device_ids.length > 0}
				<div
					class="rounded-[var(--radius-card)] border border-[var(--color-glass-border)] bg-[var(--color-bg-elev)] p-4"
				>
					<h2 class="mb-3 text-sm font-semibold text-[var(--color-fg)]">
						Linked devices
					</h2>
					<div class="flex flex-wrap gap-2">
						{#each data.devices.filter( (d) => data.linked_device_ids.includes(d.id), ) as device (device.id)}
							<a
								href="/devices/{device.slug}"
								class="inline-flex items-center gap-1 rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-1 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
							>
								{device.name ?? device.slug}
							</a>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Edit form -->
		{#if save_error}
			<div
				class="mb-4 rounded-[var(--radius)] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
			>
				{save_error}
			</div>
		{/if}

		<form onsubmit={handle_save}>
			<SubscriptionForm
				sources={data.sources}
				devices={data.devices}
				param_descriptors={param_descriptors()}
				bind:name
				bind:input_params
				bind:cron
				bind:max_items_inspected
				bind:enabled
				bind:linked_device_ids
				errors={field_errors}
				{submitting}
				submit_label="Save changes"
				show_source_select={false}
			>
				{#snippet cancel()}
					<button
						type="button"
						onclick={() => (editing = false)}
						class="inline-flex h-9 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-surface-hi)]"
						style="border-color: var(--color-glass-border);"
					>
						Cancel
					</button>
				{/snippet}
			</SubscriptionForm>
		</form>
	{/if}
</div>
