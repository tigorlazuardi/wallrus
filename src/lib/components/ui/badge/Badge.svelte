<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements"
	import type { BadgeVariant } from "./types"

	interface Props extends HTMLAttributes<HTMLSpanElement> {
		variant?: BadgeVariant
		class?: string
	}

	let { variant = "default", class: className = "", children, ...rest }: Props = $props()

	const base =
		"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"

	const variants: Record<BadgeVariant, string> = {
		default: "border-transparent text-[var(--color-accent-fg)]",
		secondary: "border-transparent bg-[var(--color-surface-hi)] text-[var(--color-fg)]",
		destructive: "border-transparent bg-red-600 text-white",
		outline: "text-[var(--color-fg)]",
	}

	const variantStyle: Record<BadgeVariant, string> = {
		default: "background: var(--color-accent);",
		secondary: "",
		destructive: "",
		outline: "border-color: var(--color-glass-border);",
	}
</script>

<span class="{base} {variants[variant]} {className}" style={variantStyle[variant]} {...rest}>
	{#if children}
		{@render children()}
	{/if}
</span>
