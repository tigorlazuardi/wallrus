<script lang="ts">
	import { onMount } from "svelte"
	import RunDetail from "$lib/components/RunDetail.svelte"
	import { subscribe } from "$lib/client/runs-stream"
	import type { Run } from "$lib/schemas/runs/Run"

	let { data } = $props()

	// SSE override — null until an SSE event for this run arrives
	let sse_run = $state<Run | null>(null)

	// Resolve: prefer SSE-updated run, fall back to server-loaded data
	const run = $derived<Run>(sse_run ?? data.run)

	onMount(() => {
		// Subscribe to SSE to keep this single row live-updated
		const cleanup = subscribe((event: Run) => {
			if (event.id === data.run.id) {
				sse_run = event
			}
		})

		return cleanup
	})
</script>

<div class="mx-auto max-w-4xl px-4 py-8">
	<div class="mb-6">
		<a
			href="/runs"
			class="text-sm transition-colors hover:opacity-80"
			style="color: var(--color-fg-muted);"
		>
			&larr; All runs
		</a>
		<h1 class="mt-2 text-2xl font-semibold" style="color: var(--color-fg);">Run detail</h1>
		<p class="mt-1 font-mono text-xs" style="color: var(--color-fg-muted);">{run.id}</p>
	</div>

	<RunDetail {run} subscription={data.subscription} />
</div>
