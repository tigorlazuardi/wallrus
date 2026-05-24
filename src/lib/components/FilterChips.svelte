<script lang="ts">
	import { page } from "$app/stores"
	import { goto } from "$app/navigation"

	// Minimal device shape — only what the filter chips need.
	interface Device {
		id: string
		slug: string
		name?: string
	}

	interface Props {
		devices?: Device[]
		sources?: string[]
	}

	let { devices = [], sources = [] }: Props = $props()

	// Derive current filter values from URL search params.
	const current_device = $derived($page.url.searchParams.get("device") ?? "")
	const current_source = $derived($page.url.searchParams.get("source") ?? "")
	const current_favorited = $derived($page.url.searchParams.get("favorited") === "true")
	const current_nsfw = $derived($page.url.searchParams.get("nsfw") ?? "")

	function update_param(key: string, value: string | null) {
		const url = new URL($page.url)
		if (value === null || value === "") {
			url.searchParams.delete(key)
		} else {
			url.searchParams.set(key, value)
		}
		// Reset pagination on filter change.
		url.searchParams.delete("next")
		url.searchParams.delete("prev")
		goto(url.toString(), { replaceState: true, keepFocus: true })
	}

	function toggle_device(slug: string) {
		update_param("device", current_device === slug ? null : slug)
	}

	function toggle_source(source: string) {
		update_param("source", current_source === source ? null : source)
	}

	function toggle_favorited() {
		update_param("favorited", current_favorited ? null : "true")
	}

	function toggle_nsfw(value: string) {
		update_param("nsfw", current_nsfw === value ? null : value)
	}

	const chip_base =
		"inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer select-none"

	function chip_style(active: boolean): string {
		if (active) {
			return `background: var(--color-accent); border-color: var(--color-accent); color: var(--color-accent-fg);`
		}
		return `background: transparent; border-color: var(--color-glass-border); color: var(--color-fg-muted);`
	}
</script>

<div class="flex flex-wrap items-center gap-2 py-2" role="group" aria-label="Gallery filters">
	<!-- Device chips -->
	{#if devices.length > 0}
		<span class="text-xs" style="color: var(--color-fg-muted);">Device:</span>
		{#each devices as device (device.id)}
			<button
				class={chip_base}
				style={chip_style(current_device === device.slug)}
				onclick={() => toggle_device(device.slug)}
				aria-pressed={current_device === device.slug}
				type="button"
			>
				{device.name ?? device.slug}
			</button>
		{/each}
	{/if}

	<!-- Source chips -->
	{#if sources.length > 0}
		<span class="ml-2 text-xs" style="color: var(--color-fg-muted);">Source:</span>
		{#each sources as source (source)}
			<button
				class={chip_base}
				style={chip_style(current_source === source)}
				onclick={() => toggle_source(source)}
				aria-pressed={current_source === source}
				type="button"
			>
				{source}
			</button>
		{/each}
	{/if}

	<!-- Favorites chip -->
	<button
		class={chip_base}
		style={chip_style(current_favorited)}
		onclick={toggle_favorited}
		aria-pressed={current_favorited}
		type="button"
	>
		★ Favorites
	</button>

	<!-- NSFW filter chips -->
	<button
		class={chip_base}
		style={chip_style(current_nsfw === "sfw_only")}
		onclick={() => toggle_nsfw("sfw_only")}
		aria-pressed={current_nsfw === "sfw_only"}
		type="button"
	>
		SFW only
	</button>

	<button
		class={chip_base}
		style={chip_style(current_nsfw === "nsfw_only")}
		onclick={() => toggle_nsfw("nsfw_only")}
		aria-pressed={current_nsfw === "nsfw_only"}
		type="button"
	>
		NSFW only
	</button>
</div>
