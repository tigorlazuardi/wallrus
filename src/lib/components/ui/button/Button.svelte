<script lang="ts">
	import type { HTMLButtonAttributes } from "svelte/elements"
	import type { ButtonVariant, ButtonSize } from "./types"

	interface Props extends HTMLButtonAttributes {
		variant?: ButtonVariant
		size?: ButtonSize
		class?: string
	}

	let {
		variant = "default",
		size = "default",
		class: className = "",
		children,
		...rest
	}: Props = $props()

	const base =
		"inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"

	const variants: Record<ButtonVariant, string> = {
		default: "text-[var(--color-accent-fg)] hover:opacity-90 active:opacity-80",
		destructive: "bg-red-600 text-white hover:bg-red-700",
		outline: "border hover:bg-[var(--color-surface-hi)]",
		secondary:
			"bg-[var(--color-surface-hi)] text-[var(--color-fg)] hover:bg-[var(--color-surface)]",
		ghost: "hover:bg-[var(--color-surface-hi)] text-[var(--color-fg)]",
		link: "text-[var(--color-accent)] underline-offset-4 hover:underline",
	}

	const sizes: Record<ButtonSize, string> = {
		default: "h-9 px-4 py-2",
		sm: "h-8 rounded-md px-3 text-xs",
		lg: "h-10 rounded-md px-8",
		icon: "h-9 w-9",
	}

	const variantStyle: Record<ButtonVariant, string> = {
		default: "background: var(--color-accent);",
		destructive: "",
		outline: "border-color: var(--color-glass-border);",
		secondary: "",
		ghost: "",
		link: "",
	}
</script>

<button
	class="{base} {variants[variant]} {sizes[size]} {className}"
	style={variantStyle[variant]}
	{...rest}
>
	{#if children}
		{@render children()}
	{/if}
</button>
