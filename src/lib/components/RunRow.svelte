<script lang="ts">
	import { goto } from "$app/navigation"
	import RunStatusBadge from "./RunStatusBadge.svelte"
	import type { Run } from "$lib/schemas/runs/Run"

	interface SubscriptionInfo {
		name: string
		source_slug: string
	}

	interface Props {
		run: Run
		subscription?: SubscriptionInfo
		class?: string
		onclick?: (run: Run) => void
	}

	let { run, subscription, class: className = "", onclick }: Props = $props()

	function format_duration(ms: number | null): string {
		if (ms === null) return "—"
		if (ms < 1_000) return `${ms}ms`
		if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`
		const minutes = Math.floor(ms / 60_000)
		const seconds = Math.floor((ms % 60_000) / 1_000)
		return `${minutes}m ${seconds}s`
	}

	function format_relative(ms: number): string {
		const diff = Date.now() - ms
		if (diff < 60_000) return "just now"
		if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
		return `${Math.floor(diff / 86_400_000)}d ago`
	}

	function format_absolute(ms: number): string {
		return new Date(ms).toLocaleString()
	}

	function handle_click() {
		if (onclick) {
			onclick(run)
		} else {
			goto(`/runs/${run.id}`)
		}
	}

	function handle_keydown(e: KeyboardEvent) {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault()
			handle_click()
		}
	}
</script>

<div
	class="flex cursor-pointer items-center gap-4 rounded-lg px-4 py-3 transition-colors {className}"
	style="background: var(--color-surface); border: 1px solid var(--color-glass-border);"
	role="button"
	tabindex="0"
	onclick={handle_click}
	onkeydown={handle_keydown}
	aria-label="Run {run.id}"
>
	<!-- Status badge -->
	<div class="w-24 shrink-0">
		<RunStatusBadge status={run.status} stop_reason={run.stop_reason} />
	</div>

	<!-- Subscription info -->
	<div class="min-w-0 flex-1">
		{#if subscription}
			<div class="truncate text-sm font-medium" style="color: var(--color-fg);">
				{subscription.name}
			</div>
			<div class="text-xs" style="color: var(--color-fg-muted);">
				{subscription.source_slug}
			</div>
		{:else}
			<div class="font-mono text-xs" style="color: var(--color-fg-muted);">
				{run.subscription_id}
			</div>
		{/if}
	</div>

	<!-- Started at -->
	<div class="w-28 shrink-0 text-right">
		<div
			class="text-sm"
			style="color: var(--color-fg);"
			title={format_absolute(run.started_at)}
		>
			{format_relative(run.started_at)}
		</div>
		<div class="text-xs" style="color: var(--color-fg-muted);">
			{format_duration(run.duration_ms)}
		</div>
	</div>

	<!-- Counters -->
	<div class="w-36 shrink-0 text-right text-xs" style="color: var(--color-fg-muted);">
		<span title="Items seen">{run.items_seen} seen</span>
		<span class="mx-1" aria-hidden="true">·</span>
		<span title="Items new" style="color: var(--color-fg);">{run.items_new} new</span>
		{#if run.items_failed_download > 0}
			<span class="mx-1" aria-hidden="true">·</span>
			<span title="Items failed download" style="color: rgb(252 165 165);">
				{run.items_failed_download} failed
			</span>
		{/if}
	</div>
</div>
