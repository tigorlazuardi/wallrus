<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui"
	import type { Snippet } from "svelte"

	interface Props {
		class?: string
		children?: Snippet
	}

	let { class: klass = "", children }: Props = $props()
</script>

<SelectPrimitive.Portal>
	<SelectPrimitive.Content
		class="relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-[var(--radius)] border border-[var(--color-glass-border)] bg-[var(--glass)] text-[var(--color-fg)] shadow-md backdrop-blur-[var(--blur)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 {klass}"
		sideOffset={4}
	>
		<SelectPrimitive.Viewport class="p-1">
			{@render children?.()}
		</SelectPrimitive.Viewport>
	</SelectPrimitive.Content>
</SelectPrimitive.Portal>
