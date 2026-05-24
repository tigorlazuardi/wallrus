<script lang="ts" module>
	export type AlertVariant = "default" | "destructive"
</script>

<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements"

	interface Props extends HTMLAttributes<HTMLDivElement> {
		variant?: AlertVariant
		class?: string
	}

	let { variant = "default", class: className = "", children, ...rest }: Props = $props()

	const base = "relative w-full rounded-lg border p-4"
	const variants: Record<AlertVariant, string> = {
		default: "",
		destructive: "border-red-600/50 text-red-600",
	}
	const variantStyle: Record<AlertVariant, string> = {
		default:
			"background: var(--color-bg-elev); border-color: var(--color-glass-border); color: var(--color-fg);",
		destructive: "",
	}
</script>

<div class="{base} {variants[variant]} {className}" style={variantStyle[variant]} {...rest}>
	{#if children}
		{@render children()}
	{/if}
</div>
