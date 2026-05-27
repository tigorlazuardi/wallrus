<script lang="ts">
	import { goto } from "$app/navigation"
	import { useSubscriptions } from "$lib/client/subscriptions/use-subscriptions.svelte"
	import type { SubscriptionsPageData } from "./+page.ts"

	let { data }: { data: SubscriptionsPageData } = $props()

	// Wire hook with initial data from universal load — no extra fetch on first paint.
	const { state } = useSubscriptions(data.subscriptions ?? undefined)

	function toggle_deleted(): void {
		const url = new URL(window.location.href)
		if (data.include_deleted) {
			url.searchParams.delete("include_deleted")
		} else {
			url.searchParams.set("include_deleted", "true")
		}
		goto(url.toString())
	}

	function format_date(ms: number): string {
		return new Date(ms).toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
		})
	}
</script>

<svelte:head>
	<title>Subscriptions — wallrus</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-[var(--color-fg)]">Subscriptions</h1>
		<div class="flex items-center gap-3">
			<button
				type="button"
				onclick={toggle_deleted}
				class="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors {data.include_deleted
					? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
					: 'border-[var(--color-glass-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:bg-[var(--color-surface-hi)]'}"
			>
				{data.include_deleted ? "Hide deleted" : "Show deleted"}
			</button>
			<a
				href="/subscriptions/new"
				class="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-[var(--color-accent-fg)] transition-colors hover:opacity-90"
				style="background: var(--color-accent);"
			>
				New subscription
			</a>
		</div>
	</div>

	{#if data.error}
		<div
			class="rounded-[var(--radius)] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
		>
			{data.error}
		</div>
	{:else if state.loading}
		<p class="text-sm text-[var(--color-fg-muted)]">Loading…</p>
	{:else if state.error}
		<div
			class="rounded-[var(--radius)] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
		>
			{state.error.message}
		</div>
	{:else if !state.data || state.data.items.length === 0}
		<div
			class="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-glass-border)] bg-[var(--color-surface)] py-16 text-center"
		>
			<p class="mb-2 text-[var(--color-fg-muted)]">No subscriptions yet.</p>
			<a href="/subscriptions/new" class="text-sm text-[var(--color-accent)] hover:underline">
				Create your first subscription
			</a>
		</div>
	{:else}
		<div class="space-y-2">
			{#each state.data.items as sub (sub.id)}
				<a
					href="/subscriptions/{sub.id}"
					class="block rounded-[var(--radius-card)] border border-[var(--color-glass-border)] bg-[var(--color-surface)] p-4 transition-colors hover:bg-[var(--color-surface-hi)] {sub.deleted_at
						? 'opacity-50'
						: ''}"
				>
					<div class="flex items-start justify-between gap-4">
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="font-medium text-[var(--color-fg)]">{sub.name}</span>
								{#if sub.deleted_at}
									<span
										class="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400"
									>
										deleted
									</span>
								{:else if !sub.enabled}
									<span
										class="rounded-full border border-[var(--color-glass-border)] bg-[var(--color-surface-hi)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-fg-muted)]"
									>
										disabled
									</span>
								{/if}
							</div>
							<div
								class="mt-1 flex flex-wrap gap-3 text-xs text-[var(--color-fg-muted)]"
							>
								<span
									>Source: <strong class="text-[var(--color-fg)]"
										>{sub.source_slug}</strong
									></span
								>
								<span
									>Cron: <code class="font-mono text-[var(--color-fg)]"
										>{sub.cron}</code
									></span
								>
								{#if sub.max_items_inspected}
									<span
										>Max items: <strong class="text-[var(--color-fg)]"
											>{sub.max_items_inspected}</strong
										></span
									>
								{/if}
							</div>
						</div>
						<div class="shrink-0 text-right text-xs text-[var(--color-fg-muted)]">
							{format_date(sub.created_at)}
						</div>
					</div>
				</a>
			{/each}
		</div>

		<p class="mt-4 text-xs text-[var(--color-fg-muted)]">
			{state.data.total} subscription{state.data.total === 1 ? "" : "s"} total
		</p>
	{/if}
</div>
