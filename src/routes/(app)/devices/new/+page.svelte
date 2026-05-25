<script lang="ts">
	import { superForm } from "sveltekit-superforms"
	import { zod4Client as zodClient } from "sveltekit-superforms/adapters"
	import { goto } from "$app/navigation"
	import { Input } from "$lib/components/ui/input"
	import { Label } from "$lib/components/ui/label"
	import FilterEditor from "$lib/components/FilterEditor.svelte"
	import { CreateDeviceRequestSchema } from "$lib/schemas/devices/CreateDevice"
	import { slugify } from "$lib/util/slugify"
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

	// Slug auto-gen from name until user manually edits slug
	let slug_dirty = $state(false)

	function handle_name_input(e: Event) {
		const target = e.target as HTMLInputElement
		$form.name = target.value
		if (!slug_dirty) {
			$form.slug = slugify($form.name)
		}
	}

	function handle_slug_input(e: Event) {
		const target = e.target as HTMLInputElement
		$form.slug = target.value
		slug_dirty = true
	}
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
		<!-- Name first -->
		<div class="space-y-1.5">
			<Label for="name">Name</Label>
			<Input
				id="name"
				type="text"
				value={$form.name}
				oninput={handle_name_input}
				placeholder="e.g. Pixel 9 Pro"
				required
			/>
			{#if $errors.name}
				<p class="text-xs text-red-500">{$errors.name[0]}</p>
			{/if}
		</div>

		<!-- Slug second — auto-derives from name until edited -->
		<div class="space-y-1.5">
			<Label for="slug">Slug</Label>
			<Input
				id="slug"
				type="text"
				value={$form.slug}
				oninput={handle_slug_input}
				placeholder="e.g. pixel-9-pro"
				required
			/>
			{#if $errors.slug}
				<p class="text-xs text-red-500">{$errors.slug[0]}</p>
			{:else}
				<p class="text-xs text-[var(--color-fg-muted)]">
					Auto-derived from name until you edit it. Lowercase, alphanumeric + hyphens.
				</p>
			{/if}
		</div>

		<div
			class="rounded-[var(--radius-card)] border border-[var(--color-glass-border)] bg-[var(--color-bg-elev)] p-4"
		>
			<h2 class="mb-4 text-sm font-semibold text-[var(--color-fg)]">Filter criteria</h2>
			<FilterEditor
				bind:value={$form.filter_criteria}
				bind:native_width={$form.native_width}
				bind:native_height={$form.native_height}
				ar_target_dirty_init={false}
			/>
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
