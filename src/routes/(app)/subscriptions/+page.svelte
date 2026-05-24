<script lang="ts">
	import { goto } from "$app/navigation"
	import type { PageData } from "./$types"

	let { data }: { data: PageData } = $props()

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
		<h1 class="text-2xl font-bold text-[var(--fg)]">Subscriptions</h1>
		<div class="flex items-center gap-3">
			<button
				type="button"
				onclick={toggle_deleted}
				class="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors {data.include_deleted
					? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
					: 'border-[var(--glass-border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--surface-hi)]'}"
			>
				{data.include_deleted ? "Hide deleted" : "Show deleted"}
			</button>
			<a
				href="/subscriptions/new"
				class="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-[var(--accent-fg)] transition-colors hover:opacity-90"
				style="background: var(--accent);"
			>
				New subscription
			</a>
		</div>
	</div>

	{#if data.subscriptions.length === 0}
		<div
			class="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-[var(--glass-border)] bg-[var(--surface)] py-16 text-center"
		>
			<p class="mb-2 text-[var(--fg-muted)]">No subscriptions yet.</p>
			<a href="/subscriptions/new" class="text-sm text-[var(--accent)] hover:underline">
				Create your first subscription
			</a>
		</div>
	{:else}
		<div class="space-y-2">
			{#each data.subscriptions as sub (sub.id)}
				<a
					href="/subscriptions/{sub.id}"
					class="block rounded-[var(--radius-card)] border border-[var(--glass-border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-hi)] {sub.deleted_at
						? 'opacity-50'
						: ''}"
				>
					<div class="flex items-start justify-between gap-4">
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="font-medium text-[var(--fg)]">{sub.name}</span>
								{#if sub.deleted_at}
									<span
										class="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400"
									>
										deleted
									</span>
								{:else if !sub.enabled}
									<span
										class="rounded-full border border-[var(--glass-border)] bg-[var(--surface-hi)] px-2 py-0.5 text-[10px] font-medium text-[var(--fg-muted)]"
									>
										disabled
									</span>
								{/if}
							</div>
							<div class="mt-1 flex flex-wrap gap-3 text-xs text-[var(--fg-muted)]">
								<span
									>Source: <strong class="text-[var(--fg)]"
										>{sub.source_slug}</strong
									></span
								>
								<span
									>Cron: <code class="font-mono text-[var(--fg)]">{sub.cron}</code
									></span
								>
								{#if sub.max_items_inspected}
									<span
										>Max items: <strong class="text-[var(--fg)]"
											>{sub.max_items_inspected}</strong
										></span
									>
								{/if}
							</div>
						</div>
						<div class="shrink-0 text-right text-xs text-[var(--fg-muted)]">
							{format_date(sub.created_at)}
						</div>
					</div>
				</a>
			{/each}
		</div>

		<p class="mt-4 text-xs text-[var(--fg-muted)]">
			{data.total} subscription{data.total === 1 ? "" : "s"} total
		</p>
	{/if}
</div>
