<script lang="ts">
	import RunStatusBadge from "./RunStatusBadge.svelte"
	import type { Run } from "$lib/schemas/runs/Run"

	interface SubscriptionInfo {
		name: string
		source_slug: string
	}

	interface Props {
		run: Run
		subscription?: SubscriptionInfo
	}

	let { run, subscription }: Props = $props()

	function format_duration(ms: number | null): string {
		if (ms === null) return "—"
		if (ms < 1_000) return `${ms}ms`
		if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`
		const minutes = Math.floor(ms / 60_000)
		const seconds = Math.floor((ms % 60_000) / 1_000)
		return `${minutes}m ${seconds}s`
	}

	function format_ts(ms: number | null): string {
		if (ms === null) return "—"
		return new Date(ms).toLocaleString()
	}

	const counters = $derived([
		{ label: "Items seen", value: run.items_seen },
		{ label: "Items new", value: run.items_new },
		{ label: "Items failed download", value: run.items_failed_download },
		{ label: "Items skipped (no device)", value: run.items_skipped_no_device },
	])
</script>

<div class="space-y-6">
	<!-- Header: status + subscription -->
	<div class="flex flex-wrap items-start gap-4">
		<RunStatusBadge status={run.status} stop_reason={run.stop_reason} class="text-sm" />
		{#if subscription}
			<div>
				<div class="text-sm font-medium" style="color: var(--color-fg);">
					{subscription.name}
				</div>
				<div class="text-xs" style="color: var(--color-fg-muted);">
					{subscription.source_slug}
				</div>
			</div>
		{/if}
	</div>

	<!-- Timing -->
	<div
		class="grid grid-cols-2 gap-4 rounded-lg p-4 sm:grid-cols-4"
		style="background: var(--color-surface); border: 1px solid var(--color-glass-border);"
	>
		<div>
			<div class="text-xs uppercase tracking-wide" style="color: var(--color-fg-muted);">
				Started
			</div>
			<div class="mt-1 text-sm" style="color: var(--color-fg);">
				{format_ts(run.started_at)}
			</div>
		</div>
		<div>
			<div class="text-xs uppercase tracking-wide" style="color: var(--color-fg-muted);">
				Ended
			</div>
			<div class="mt-1 text-sm" style="color: var(--color-fg);">
				{format_ts(run.ended_at)}
			</div>
		</div>
		<div>
			<div class="text-xs uppercase tracking-wide" style="color: var(--color-fg-muted);">
				Duration
			</div>
			<div class="mt-1 text-sm font-mono" style="color: var(--color-fg);">
				{format_duration(run.duration_ms)}
			</div>
		</div>
		<div>
			<div class="text-xs uppercase tracking-wide" style="color: var(--color-fg-muted);">
				Stop reason
			</div>
			<div class="mt-1 text-sm" style="color: var(--color-fg);">
				{run.stop_reason ?? "—"}
			</div>
		</div>
	</div>

	<!-- Counters -->
	<div
		class="rounded-lg p-4"
		style="background: var(--color-surface); border: 1px solid var(--color-glass-border);"
	>
		<h3 class="mb-3 text-sm font-semibold" style="color: var(--color-fg);">Counters</h3>
		<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each counters as { label, value } (label)}
				<div>
					<dt class="text-xs" style="color: var(--color-fg-muted);">{label}</dt>
					<dd
						class="mt-0.5 text-lg font-mono font-semibold"
						style="color: var(--color-fg);"
					>
						{value}
					</dd>
				</div>
			{/each}
		</dl>
	</div>

	<!-- Error message (only when present) -->
	{#if run.error}
		<div
			class="rounded-lg p-4"
			style="background: rgb(220 38 38 / 0.1); border: 1px solid rgb(239 68 68 / 0.3);"
			data-testid="run-error"
		>
			<h3 class="mb-2 text-sm font-semibold" style="color: rgb(252 165 165);">Error</h3>
			<pre
				class="whitespace-pre-wrap break-words text-sm font-mono"
				style="color: rgb(254 202 202);">{run.error}</pre>
		</div>
	{/if}

	<!-- Input params snapshot -->
	<div
		class="rounded-lg p-4"
		style="background: var(--color-surface); border: 1px solid var(--color-glass-border);"
	>
		<h3 class="mb-3 text-sm font-semibold" style="color: var(--color-fg);">
			Input Parameters (snapshot)
		</h3>
		<pre
			class="overflow-x-auto rounded-md p-3 text-xs font-mono"
			style="background: var(--color-bg); color: var(--color-fg-muted);">{JSON.stringify(
				run.input_params_snapshot,
				null,
				2,
			)}</pre>
	</div>

	<!-- Per-device adds (only if non-empty) -->
	{#if Object.keys(run.device_adds).length > 0}
		<div
			class="rounded-lg p-4"
			style="background: var(--color-surface); border: 1px solid var(--color-glass-border);"
		>
			<h3 class="mb-3 text-sm font-semibold" style="color: var(--color-fg);">
				Per-device adds
			</h3>
			<dl class="space-y-1">
				{#each Object.entries(run.device_adds) as [device_id, count] (device_id)}
					<div class="flex justify-between">
						<dt class="font-mono text-xs" style="color: var(--color-fg-muted);">
							{device_id}
						</dt>
						<dd class="text-xs font-semibold" style="color: var(--color-fg);">
							{count}
						</dd>
					</div>
				{/each}
			</dl>
		</div>
	{/if}
</div>
