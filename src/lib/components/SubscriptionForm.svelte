<script lang="ts">
	import { Input } from "$lib/components/ui/input"
	import { Label } from "$lib/components/ui/label"
	import { Switch } from "$lib/components/ui/switch"
	import { SelectRoot, SelectTrigger, SelectContent, SelectItem } from "$lib/components/ui/select"
	import CronInput from "$lib/components/CronInput.svelte"
	import TagsInput from "$lib/components/TagsInput.svelte"
	import DeviceSelector from "$lib/components/DeviceSelector.svelte"

	// Source info shape returned by GET /api/v1/sources
	interface SourceInfo {
		slug: string
		display_name: string
	}

	// Device info shape
	interface DeviceInfo {
		id: string
		slug: string
		name?: string
	}

	import type { Snippet } from "svelte"
	import type { ParamDescriptor } from "./SubscriptionForm.types"

	interface Props {
		// List of available sources (fetched by parent)
		sources?: SourceInfo[]
		// List of all devices (fetched by parent)
		devices?: DeviceInfo[]
		// Param descriptors for the selected source (fetched by parent on source change)
		param_descriptors?: ParamDescriptor[]
		// Bound form values
		source_slug?: string
		name?: string
		input_params?: Record<string, unknown>
		cron?: string
		max_items_inspected?: number | null
		enabled?: boolean
		// Linked device ids (for edit mode)
		linked_device_ids?: string[]
		// Error messages
		errors?: Partial<Record<string, string | string[]>>
		// Whether the form is being submitted
		submitting?: boolean
		// Label override for the submit button
		submit_label?: string
		// Whether to show the source select (false in edit mode — source can't change)
		show_source_select?: boolean
		// Cancel button snippet (optional)
		cancel?: Snippet
	}

	let {
		sources = [],
		devices = [],
		param_descriptors = [],
		source_slug = $bindable(""),
		name = $bindable(""),
		input_params = $bindable({}),
		cron = $bindable("0 * * * *"),
		max_items_inspected = $bindable(null),
		enabled = $bindable(true),
		linked_device_ids = $bindable([]),
		errors = {},
		submitting = false,
		submit_label = "Save",
		show_source_select = true,
		cancel,
	}: Props = $props()

	function get_error(field: string): string | undefined {
		const val = errors[field]
		if (!val) return undefined
		return Array.isArray(val) ? val[0] : val
	}

	function get_param_value(key: string): unknown {
		return (input_params as Record<string, unknown>)[key] ?? undefined
	}

	function set_param_value(key: string, val: unknown): void {
		input_params = { ...(input_params as Record<string, unknown>), [key]: val }
	}
</script>

<div class="space-y-6">
	<!-- Source select -->
	{#if show_source_select}
		<div class="space-y-1.5">
			<Label for="source_slug">Source</Label>
			{#if sources.length === 0}
				<p class="text-sm text-[var(--fg-muted)]">Loading sources…</p>
			{:else}
				<SelectRoot
					type="single"
					value={source_slug}
					onValueChange={(v) => {
						source_slug = v ?? ""
					}}
				>
					<SelectTrigger placeholder="Select a source…" />
					<SelectContent>
						{#each sources as src (src.slug)}
							<SelectItem value={src.slug} label={src.display_name} />
						{/each}
					</SelectContent>
				</SelectRoot>
			{/if}
			{#if get_error("source_slug")}
				<p class="text-xs text-red-500">{get_error("source_slug")}</p>
			{/if}
		</div>
	{/if}

	<!-- Subscription name -->
	<div class="space-y-1.5">
		<Label for="sub_name">Name</Label>
		<Input
			id="sub_name"
			type="text"
			bind:value={name}
			placeholder="e.g. r/wallpapers hot"
			required
		/>
		{#if get_error("name")}
			<p class="text-xs text-red-500">{get_error("name")}</p>
		{/if}
	</div>

	<!-- Enabled toggle -->
	<div class="flex items-center gap-3">
		<Switch id="sub_enabled" bind:checked={enabled} />
		<Label for="sub_enabled" class="cursor-pointer">Enabled</Label>
	</div>

	<!-- Dynamic source params -->
	{#if param_descriptors.length > 0}
		<div
			class="rounded-[var(--radius)] border border-[var(--glass-border)] bg-[var(--surface)] p-4"
		>
			<h2 class="mb-4 text-sm font-semibold text-[var(--fg)]">Source parameters</h2>
			<div class="space-y-4">
				{#each param_descriptors as desc (desc.key)}
					<div class="space-y-1.5">
						<Label for="param_{desc.key}">{desc.label ?? desc.key}</Label>

						{#if desc.type === "string"}
							<Input
								id="param_{desc.key}"
								type="text"
								value={(get_param_value(desc.key) as string) ?? ""}
								oninput={(e) =>
									set_param_value(desc.key, (e.target as HTMLInputElement).value)}
							/>
						{:else if desc.type === "number"}
							<Input
								id="param_{desc.key}"
								type="number"
								value={(get_param_value(desc.key) as number) ?? ""}
								oninput={(e) =>
									set_param_value(
										desc.key,
										(e.target as HTMLInputElement).value === ""
											? undefined
											: Number((e.target as HTMLInputElement).value),
									)}
							/>
						{:else if desc.type === "boolean"}
							<div class="flex items-center gap-2">
								<Switch
									id="param_{desc.key}"
									checked={(get_param_value(desc.key) as boolean) ?? false}
									onCheckedChange={(v) => set_param_value(desc.key, v)}
								/>
							</div>
						{:else if desc.type === "enum" && desc.enum_values}
							<SelectRoot
								type="single"
								value={(get_param_value(desc.key) as string) ?? ""}
								onValueChange={(v) => set_param_value(desc.key, v ?? "")}
							>
								<SelectTrigger placeholder="Select…" />
								<SelectContent>
									{#each desc.enum_values as ev (ev)}
										<SelectItem value={ev} label={ev} />
									{/each}
								</SelectContent>
							</SelectRoot>
						{:else if desc.type === "array_string"}
							<TagsInput
								value={(get_param_value(desc.key) as string[]) ?? []}
								placeholder="Add value…"
							/>
						{/if}

						{#if get_error(`input_params.${desc.key}`)}
							<p class="text-xs text-red-500">
								{get_error(`input_params.${desc.key}`)}
							</p>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{:else if source_slug && param_descriptors.length === 0}
		<div
			class="rounded-[var(--radius)] border border-[var(--glass-border)] bg-[var(--surface)] p-4"
		>
			<p class="text-sm text-[var(--fg-muted)]">
				This source has no configurable parameters.
			</p>
		</div>
	{/if}

	<!-- Cron -->
	<div class="space-y-1.5">
		<Label>Schedule (cron)</Label>
		<CronInput bind:value={cron} />
		{#if get_error("cron")}
			<p class="text-xs text-red-500">{get_error("cron")}</p>
		{/if}
	</div>

	<!-- Max items inspected -->
	<div class="space-y-1.5">
		<Label for="max_items">Max items inspected</Label>
		<Input
			id="max_items"
			type="number"
			value={max_items_inspected ?? ""}
			oninput={(e) => {
				const v = (e.target as HTMLInputElement).value
				max_items_inspected = v === "" ? null : Number(v)
			}}
			placeholder="300 (default)"
			min="1"
		/>
		<p class="text-xs text-[var(--fg-muted)]">
			Number of source items checked per run. Leave blank for the default (300).
		</p>
		{#if get_error("max_items_inspected")}
			<p class="text-xs text-red-500">{get_error("max_items_inspected")}</p>
		{/if}
	</div>

	<!-- Device links -->
	{#if devices.length > 0}
		<div class="space-y-1.5">
			<Label>Linked devices</Label>
			<DeviceSelector bind:value={linked_device_ids} {devices} />
			<p class="text-xs text-[var(--fg-muted)]">
				Images from this subscription will be fanned out to selected devices.
			</p>
		</div>
	{/if}

	<!-- Submit area -->
	<div class="flex gap-3 pt-2">
		<button
			type="submit"
			disabled={submitting}
			class="inline-flex h-9 items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-[var(--accent-fg)] transition-colors hover:opacity-90 disabled:opacity-50"
			style="background: var(--accent);"
		>
			{submitting ? "Saving…" : submit_label}
		</button>
		{#if cancel}{@render cancel()}{/if}
	</div>
</div>
