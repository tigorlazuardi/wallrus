<script lang="ts">
	import { untrack } from "svelte"
	import { onMount } from "svelte"
	import { goto } from "$app/navigation"
	import { page } from "$app/stores"
	import RunRow from "$lib/components/RunRow.svelte"
	import Sparkline from "$lib/components/Sparkline.svelte"
	import { subscribe } from "$lib/client/runs-stream"
	import type { Run } from "$lib/schemas/runs/Run"

	let { data } = $props()

	let runs = $state<Run[]>(untrack(() => data.runs.slice()))
	let total = $state(untrack(() => data.total))

	$effect(() => {
		runs = data.runs.slice()
		total = data.total
	})

	const subscription_info = $derived({
		name: data.subscription.name,
		source_slug: data.subscription.source_slug,
	})

	const sparkline_statuses = $derived(runs.map((r) => r.status))

	onMount(() => {
		const cleanup = subscribe((event: Run) => {
			// Only update if event belongs to this subscription
			if (event.subscription_id !== data.subscription.id) return

			const idx = runs.findIndex((r) => r.id === event.id)
			if (idx >= 0) {
				runs = runs.map((r) => (r.id === event.id ? event : r))
			} else if (event.status === "running") {
				runs = [event, ...runs]
				total = total + 1
			}
		})

		return cleanup
	})

	function prev_page() {
		const cursor = data.prev_cursor
		if (!cursor) return
		goto(`/subscriptions/${data.subscription.id}/runs?prev=${encodeURIComponent(cursor)}`)
	}

	function next_page() {
		const cursor = data.next_cursor
		if (!cursor) return
		goto(`/subscriptions/${data.subscription.id}/runs?next=${encodeURIComponent(cursor)}`)
	}

	const has_prev = $derived(!!data.prev_cursor && $page.url.searchParams.has("next"))
	const has_next = $derived(!!data.next_cursor)
</script>

<div class="mx-auto max-w-5xl px-4 py-8">
	<div class="mb-6">
		<a
			href="/subscriptions/{data.subscription.id}"
			class="text-sm transition-colors hover:opacity-80"
			style="color: var(--color-fg-muted);"
		>
			&larr; {data.subscription.name}
		</a>
		<div class="mt-2 flex flex-wrap items-center gap-4">
			<h1 class="text-2xl font-semibold" style="color: var(--color-fg);">Run history</h1>
			{#if sparkline_statuses.length > 0}
				<Sparkline statuses={sparkline_statuses} />
			{/if}
		</div>
		<p class="mt-1 text-sm" style="color: var(--color-fg-muted);">
			{total} run{total !== 1 ? "s" : ""} for
			<span class="font-medium">{data.subscription.name}</span>
			<span class="ml-1 opacity-60">({data.subscription.source_slug})</span>
		</p>
	</div>

	{#if runs.length === 0}
		<div
			class="rounded-lg p-12 text-center"
			style="background: var(--color-surface); border: 1px solid var(--color-glass-border);"
		>
			<p class="text-sm" style="color: var(--color-fg-muted);">
				No runs yet. Subscriptions will run on their cron.
			</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each runs as run (run.id)}
				<RunRow {run} subscription={subscription_info} />
			{/each}
		</div>

		{#if has_prev || has_next}
			<div class="mt-6 flex items-center justify-between">
				<button
					onclick={prev_page}
					disabled={!has_prev}
					class="rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
					style="background: var(--color-surface); color: var(--color-fg); border: 1px solid var(--color-glass-border);"
				>
					Previous
				</button>
				<button
					onclick={next_page}
					disabled={!has_next}
					class="rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
					style="background: var(--color-surface); color: var(--color-fg); border: 1px solid var(--color-glass-border);"
				>
					Next
				</button>
			</div>
		{/if}
	{/if}
</div>
