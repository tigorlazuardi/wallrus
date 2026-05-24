<script lang="ts">
	interface Props {
		value?: string[]
		placeholder?: string
		class?: string
	}

	let { value = $bindable([]), placeholder = "Add tag…", class: klass = "" }: Props = $props()

	let input_text = $state("")

	function add_tag(raw: string): void {
		const tag = raw.trim().toLowerCase()
		if (tag && !value.includes(tag)) {
			value = [...value, tag]
		}
		input_text = ""
	}

	function remove_tag(tag: string): void {
		value = value.filter((t) => t !== tag)
	}

	function handle_keydown(e: KeyboardEvent): void {
		if (e.key === "Enter") {
			e.preventDefault()
			add_tag(input_text)
		} else if (e.key === "Backspace" && input_text === "" && value.length > 0) {
			value = value.slice(0, -1)
		}
	}
</script>

<div
	class="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-[var(--radius)] border border-[var(--glass-border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--fg)] focus-within:ring-1 focus-within:ring-[var(--ring)] {klass}"
>
	{#each value as tag (tag)}
		<span
			class="inline-flex items-center gap-1 rounded-full bg-[var(--surface-hi)] px-2 py-0.5 text-xs font-medium text-[var(--fg)]"
		>
			{tag}
			<button
				type="button"
				onclick={() => remove_tag(tag)}
				aria-label="Remove tag {tag}"
				class="flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-[var(--glass-border)] focus:outline-none"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-2.5 w-2.5"
					aria-hidden="true"
				>
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</span>
	{/each}
	<input
		type="text"
		bind:value={input_text}
		onkeydown={handle_keydown}
		{placeholder}
		class="min-w-[6rem] flex-1 bg-transparent outline-none placeholder:text-[var(--fg-muted)]"
	/>
</div>
