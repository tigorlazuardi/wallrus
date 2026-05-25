<script lang="ts">
	import { page } from "$app/stores"
	import ThemeToggle from "$lib/components/ThemeToggle.svelte"

	let { children } = $props()

	const nav_items = [
		{ label: "Gallery", href: "/" },
		{ label: "Devices", href: "/devices" },
		{ label: "Subscriptions", href: "/subscriptions" },
		{ label: "Runs", href: "/runs" },
	]

	function is_active(href: string): boolean {
		if (href === "/") return $page.url.pathname === "/"
		return $page.url.pathname.startsWith(href)
	}
</script>

<div class="min-h-dvh" style="background: var(--color-bg); color: var(--color-fg);">
	<!-- Top navigation bar with glass chrome -->
	<header
		class="glass sticky top-0 z-50 border-b"
		style="
			backdrop-filter: blur(20px) saturate(180%);
			-webkit-backdrop-filter: blur(20px) saturate(180%);
			background: var(--color-glass);
			border-color: var(--color-glass-border);
		"
	>
		<div class="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
			<a
				href="/"
				class="mr-4 text-lg font-semibold tracking-tight"
				style="color: var(--color-fg);"
			>
				wallrus
			</a>

			<nav class="flex items-center gap-1">
				{#each nav_items as item (item.href)}
					<a
						href={item.href}
						class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
						style={is_active(item.href)
							? "background: var(--color-surface-hi); color: var(--color-fg);"
							: "color: var(--color-fg-muted);"}
					>
						{item.label}
					</a>
				{/each}
			</nav>

			<div class="ml-auto">
				<ThemeToggle />
			</div>
		</div>
	</header>

	<!-- Page content -->
	<main>
		{@render children?.()}
	</main>
</div>
