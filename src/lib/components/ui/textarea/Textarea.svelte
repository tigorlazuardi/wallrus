<script lang="ts">
	import type { HTMLTextareaAttributes } from "svelte/elements"

	type Props = HTMLTextareaAttributes & {
		class?: string
	}

	let { class: klass = "", ...rest }: Props = $props()
</script>

<textarea
	class="flex min-h-[60px] w-full rounded-[var(--radius)] border border-[var(--glass-border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] shadow-sm placeholder:text-[var(--fg-muted)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 {klass}"
	{...rest}
></textarea>
