<script lang="ts">
	interface Device {
		id: string
		slug: string
		name?: string
	}

	interface Props {
		value?: string[]
		devices?: Device[]
		class?: string
	}

	let { value = $bindable([]), devices = [], class: klass = "" }: Props = $props()

	function toggle(id: string): void {
		if (value.includes(id)) {
			value = value.filter((v) => v !== id)
		} else {
			value = [...value, id]
		}
	}

	function is_selected(id: string): boolean {
		return value.includes(id)
	}
</script>

<div class="flex flex-wrap gap-2 {klass}">
	{#if devices.length === 0}
		<p class="text-sm text-[var(--color-fg-muted)]">No devices available.</p>
	{:else}
		{#each devices as device (device.id)}
			<button
				type="button"
				onclick={() => toggle(device.id)}
				aria-pressed={is_selected(device.id)}
				class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] {is_selected(
					device.id,
				)
					? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
					: 'border-[var(--color-glass-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:bg-[var(--color-surface-hi)]'}"
			>
				{device.name ?? device.slug}
			</button>
		{/each}
	{/if}
</div>
