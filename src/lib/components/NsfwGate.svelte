<script lang="ts">
	import type { Snippet } from "svelte"

	interface Props {
		nsfw: "sfw" | "nsfw" | "unknown"
		children?: Snippet
	}

	let { nsfw, children }: Props = $props()

	// Per-card reveal state — does NOT flip the global flag.
	let revealed = $state(false)

	// Sync revealed from sessionStorage on mount.
	$effect(() => {
		if (typeof window === "undefined") return
		try {
			const global_revealed = sessionStorage.getItem("nsfw_revealed") === "true"
			if (global_revealed) revealed = true
		} catch {
			// sessionStorage may be unavailable in certain contexts.
		}
	})

	const needs_gate = $derived(nsfw === "nsfw" && !revealed)

	function reveal(e: MouseEvent | KeyboardEvent) {
		e.stopPropagation()
		revealed = true
	}

	function handle_keydown(e: KeyboardEvent) {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault()
			reveal(e)
		}
	}
</script>

<div class="relative w-full" data-nsfw={nsfw}>
	{#if children}
		{@render children()}
	{/if}

	{#if needs_gate}
		<!-- Blur overlay — covers children via absolute positioning -->
		<div
			class="absolute inset-0 flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-card)]"
			style="backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); background: rgb(0 0 0 / 0.3);"
			onclick={reveal}
			onkeydown={handle_keydown}
			role="button"
			tabindex="0"
			aria-label="Click to reveal NSFW content"
		>
			<span class="text-2xl" aria-hidden="true">🔞</span>
			<p class="mt-2 text-sm font-medium" style="color: #e8e8ec;">NSFW — click to reveal</p>
		</div>
	{/if}
</div>
