<script lang="ts">
	import { superForm } from "sveltekit-superforms"
	import { zod4Client as zodClient } from "sveltekit-superforms/adapters"
	import { goto } from "$app/navigation"
	import { Input } from "$lib/components/ui/input"
	import { Label } from "$lib/components/ui/label"
	import FilterEditor from "$lib/components/FilterEditor.svelte"
	import { CreateDeviceRequestSchema } from "$lib/schemas/devices/CreateDevice"
	import type { PageData } from "./$types"

	let { data }: { data: PageData } = $props()

	const { form, errors, enhance, submitting } = superForm(data.form, {
		dataType: "json",
		validators: zodClient(CreateDeviceRequestSchema),
		onResult: ({ result }) => {
			if (result.type === "redirect") {
				goto(result.location)
			}
		},
	})
</script>

<svelte:head>
	<title>New device — wallrus</title>
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-8">
	<div class="mb-6 flex items-center gap-3">
		<a
			href="/devices"
			class="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
		>
			&larr; Devices
		</a>
		<h1 class="text-2xl font-bold text-[var(--color-fg)]">New device</h1>
	</div>

	{#if $errors._errors}
		<div
			class="mb-4 rounded-[var(--radius)] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
		>
			{$errors._errors.join(", ")}
		</div>
	{/if}

	<form method="POST" use:enhance class="space-y-6">
		<div class="space-y-1.5">
			<Label for="slug">Slug</Label>
			<Input
				id="slug"
				type="text"
				bind:value={$form.slug}
				placeholder="e.g. phone-pixel"
				required
			/>
			{#if $errors.slug}
				<p class="text-xs text-red-500">{$errors.slug[0]}</p>
			{:else}
				<p class="text-xs text-[var(--color-fg-muted)]">
					Lowercase, alphanumeric + hyphens. Used in API paths and on-disk directories.
				</p>
			{/if}
		</div>

		<div class="space-y-1.5">
			<Label for="name">Name</Label>
			<Input
				id="name"
				type="text"
				bind:value={$form.name}
				placeholder="e.g. Pixel 9 Pro"
				required
			/>
			{#if $errors.name}
				<p class="text-xs text-red-500">{$errors.name[0]}</p>
			{/if}
		</div>

		<div
			class="rounded-[var(--radius-card)] border border-[var(--color-glass-border)] bg-[var(--color-bg-elev)] p-4"
		>
			<h2 class="mb-4 text-sm font-semibold text-[var(--color-fg)]">Filter criteria</h2>
			<FilterEditor bind:value={$form.filter_criteria} />
		</div>

		<div class="flex gap-3 pt-2">
			<button
				type="submit"
				disabled={$submitting}
				class="inline-flex h-9 items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] transition-colors hover:opacity-90 disabled:opacity-50"
				style="background: var(--color-accent);"
			>
				{$submitting ? "Creating…" : "Create device"}
			</button>
			<a
				href="/devices"
				class="inline-flex h-9 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-surface-hi)]"
				style="border-color: var(--color-glass-border);"
			>
				Cancel
			</a>
		</div>
	</form>
</div>
