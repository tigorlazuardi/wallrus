<script lang="ts">
	import { Sun, Moon, Monitor } from "lucide-svelte"
	import { themeStore, type Theme } from "$lib/stores/theme.svelte"

	const labels: Record<Theme, string> = {
		light: "Switch to dark mode (currently light)",
		dark: "Switch to system mode (currently dark)",
		system: "Switch to light mode (currently system)",
	}
</script>

<button
	type="button"
	onclick={() => themeStore.cycle()}
	aria-label={labels[themeStore.current]}
	class="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius)] transition-colors hover:bg-[var(--color-surface-hi)]"
	style="color: var(--color-fg-muted);"
>
	{#if themeStore.current === "light"}
		<Sun class="h-4 w-4" />
	{:else if themeStore.current === "dark"}
		<Moon class="h-4 w-4" />
	{:else}
		<Monitor class="h-4 w-4" />
	{/if}
</button>
