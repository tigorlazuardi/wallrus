<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "$lib/components/ui/card"
	import { Badge } from "$lib/components/ui/badge"
	import { useDevices } from "$lib/client/devices/use-devices.svelte"
	import type { DevicesPageData } from "./+page.ts"

	let { data }: { data: DevicesPageData } = $props()

	// Wire hook with initial data from universal load — no extra fetch on first paint.
	const { state } = useDevices(data.devices ?? undefined)
</script>

<svelte:head>
	<title>Devices — wallrus</title>
</svelte:head>

<div class="container mx-auto max-w-5xl px-4 py-8">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-[var(--color-fg)]">Devices</h1>
		<a
			href="/devices/new"
			class="inline-flex h-9 items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ring)]"
			style="background: var(--color-accent);"
		>
			Create device
		</a>
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
		<div class="flex flex-col items-center gap-3 py-16 text-center">
			<p class="text-[var(--color-fg-muted)]">No devices configured yet.</p>
			<a
				href="/devices/new"
				class="inline-flex h-9 items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] transition-colors hover:opacity-90"
				style="background: var(--color-accent);"
			>
				Create your first device
			</a>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each state.data.items as device (device.id)}
				<Card class="flex flex-col">
					<CardHeader class="pb-2">
						<div class="flex items-start justify-between gap-2">
							<CardTitle class="text-base">{device.name}</CardTitle>
							<Badge variant={device.enabled ? "default" : "secondary"}>
								{device.enabled ? "enabled" : "disabled"}
							</Badge>
						</div>
						<p class="font-mono text-xs text-[var(--color-fg-muted)]">{device.slug}</p>
					</CardHeader>
					<CardContent class="flex-1 pb-2">
						<p class="text-xs text-[var(--color-fg-muted)]">
							NSFW: {device.filter_criteria.nsfw}
						</p>
					</CardContent>
					<CardFooter class="gap-2 pt-2">
						<a
							href="/devices/{device.slug}"
							class="inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-surface-hi)]"
							style="border-color: var(--color-glass-border);"
						>
							View
						</a>
						<a
							href="/devices/{device.slug}/edit"
							class="inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-surface-hi)]"
							style="border-color: var(--color-glass-border);"
						>
							Edit
						</a>
					</CardFooter>
				</Card>
			{/each}
		</div>
	{/if}
</div>
