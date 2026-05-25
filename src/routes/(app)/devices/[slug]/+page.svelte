<script lang="ts">
	import { untrack } from "svelte"
	import { Badge } from "$lib/components/ui/badge"
	import FilterEditor from "$lib/components/FilterEditor.svelte"
	import type { DeviceFilters } from "$lib/schemas/devices/DeviceFilters"
	import type { DeviceDetailData } from "./+page.ts"

	let { data }: { data: DeviceDetailData } = $props()

	// Local copy of filter_criteria for live editing.
	// untrack() avoids a state_referenced_locally warning — we only want the
	// initial value from `data`; reactive sync with `data` is not needed.
	let filter_criteria = $state<DeviceFilters>(
		untrack(() => data.device?.filter_criteria ?? { nsfw: "all" }),
	)
	let save_status = $state<"idle" | "saving" | "saved" | "error">("idle")
	let save_error = $state<string | null>(null)
	let save_timer: ReturnType<typeof setTimeout> | undefined

	// Debounced PATCH on filter change
	$effect(() => {
		// Capture current value — creates reactive dependency
		const current = filter_criteria
		const device = data.device
		if (!device) return

		clearTimeout(save_timer)
		save_timer = setTimeout(async () => {
			save_status = "saving"
			save_error = null
			try {
				const res = await fetch(`/api/v1/devices/${device.slug}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ filter_criteria: current }),
				})
				if (res.ok) {
					save_status = "saved"
					setTimeout(() => {
						save_status = "idle"
					}, 2000)
				} else {
					save_status = "error"
					save_error = `Save failed (${res.status})`
				}
			} catch {
				save_status = "error"
				save_error = "Network error."
			}
		}, 800)
	})

	function format_date(ms: number): string {
		return new Date(ms).toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
		})
	}
</script>

<svelte:head>
	<title>{data.device?.name ?? data.device?.slug ?? "Device"} — wallrus</title>
</svelte:head>

<div class="container mx-auto max-w-5xl px-4 py-8">
	<!-- Breadcrumb -->
	<div class="mb-6 flex items-center gap-2 text-sm text-[var(--color-fg-muted)]">
		<a href="/devices" class="hover:text-[var(--color-fg)]">Devices</a>
		<span>/</span>
		<span class="text-[var(--color-fg)]">{data.device?.name ?? data.device?.slug}</span>
	</div>

	{#if data.error}
		<div
			class="rounded-[var(--radius)] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
		>
			{data.error}
		</div>
	{:else if data.device}
		{@const device = data.device}
		<!-- Header -->
		<div class="mb-6 flex flex-wrap items-start justify-between gap-4">
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-2xl font-bold text-[var(--color-fg)]">{device.name}</h1>
					<Badge variant={device.enabled ? "default" : "secondary"}>
						{device.enabled ? "enabled" : "disabled"}
					</Badge>
				</div>
				<p class="mt-1 font-mono text-sm text-[var(--color-fg-muted)]">{device.slug}</p>
				<p class="mt-0.5 text-xs text-[var(--color-fg-muted)]">
					Created {format_date(device.created_at)}
				</p>
			</div>
			<a
				href="/devices/{device.slug}/edit"
				class="inline-flex h-9 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-surface-hi)]"
				style="border-color: var(--color-glass-border);"
			>
				Edit
			</a>
		</div>

		<!-- Filter editor (live save) -->
		<section class="mb-8">
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-[var(--color-fg)]">Filter criteria</h2>
				{#if save_status === "saving"}
					<span class="text-xs text-[var(--color-fg-muted)]">Saving…</span>
				{:else if save_status === "saved"}
					<span class="text-xs text-green-400">Saved</span>
				{:else if save_status === "error"}
					<span class="text-xs text-red-400">{save_error}</span>
				{/if}
			</div>
			<div
				class="rounded-[var(--radius)] border border-[var(--color-glass-border)] bg-[var(--color-surface)] p-4"
			>
				<FilterEditor bind:value={filter_criteria} />
			</div>
		</section>

		<!-- Gallery (per-device images) -->
		<section class="mb-8">
			<h2 class="mb-3 text-lg font-semibold text-[var(--color-fg)]">
				Images
				{#if data.images_total > 0}
					<span class="ml-1 text-sm font-normal text-[var(--color-fg-muted)]">
						({data.images_total.toLocaleString()})
					</span>
				{/if}
			</h2>

			{#if data.images.length === 0}
				<p class="text-sm text-[var(--color-fg-muted)]">No images for this device yet.</p>
			{:else}
				<div class="columns-2 gap-2 sm:columns-3 lg:columns-4">
					{#each data.images as image (image.id)}
						<a
							href="/images/{image.id}"
							class="mb-2 block overflow-hidden rounded-[var(--radius)]"
						>
							<img
								src="/api/v1/images/{image.id}/thumbnail"
								alt={image.title || "untitled"}
								loading="lazy"
								decoding="async"
								class="w-full"
								data-nsfw={image.nsfw}
							/>
						</a>
					{/each}
				</div>
				{#if data.images_next_cursor}
					<div class="mt-4 text-center">
						<a
							href="/devices/{device.slug}?next={data.images_next_cursor}"
							class="text-sm text-[var(--color-accent)] hover:underline"
						>
							Load more
						</a>
					</div>
				{/if}
			{/if}
		</section>
	{/if}
</div>
