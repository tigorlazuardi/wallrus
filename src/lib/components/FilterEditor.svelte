<script lang="ts">
	import type { DeviceFilters } from "$lib/schemas/devices/DeviceFilters"
	import { Input } from "$lib/components/ui/input"
	import { Label } from "$lib/components/ui/label"
	import { Slider } from "$lib/components/ui/slider"
	import { Checkbox } from "$lib/components/ui/checkbox"
	import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group"
	import TagsInput from "./TagsInput.svelte"

	const FORMATS = ["jpg", "png", "webp", "avif"] as const
	type Format = (typeof FORMATS)[number]

	interface Props {
		value?: DeviceFilters
		class?: string
	}

	let {
		value = $bindable({
			nsfw: "all",
		}),
		class: klass = "",
	}: Props = $props()

	// Resolution inputs — convert undefined ↔ "" for input binding
	let min_width_str = $state(value.min_width !== undefined ? String(value.min_width) : "")
	let max_width_str = $state(value.max_width !== undefined ? String(value.max_width) : "")
	let min_height_str = $state(value.min_height !== undefined ? String(value.min_height) : "")
	let max_height_str = $state(value.max_height !== undefined ? String(value.max_height) : "")

	// Aspect ratio inputs
	let aspect_target_str = $state(
		value.aspect_ratio !== undefined ? String(value.aspect_ratio.target) : "",
	)
	let aspect_tolerance = $state(
		value.aspect_ratio !== undefined ? [value.aspect_ratio.tolerance] : [0.15],
	)

	// File size inputs (MB in UI, bytes in payload)
	let min_mb_str = $state(
		value.min_bytes !== undefined ? String(value.min_bytes / 1_000_000) : "",
	)
	let max_mb_str = $state(
		value.max_bytes !== undefined ? String(value.max_bytes / 1_000_000) : "",
	)

	// Format checkboxes
	let selected_formats = $state<Format[]>(value.formats ?? [])

	// Tags
	let tags_include = $state(value.tags_include ?? [])
	let tags_exclude = $state(value.tags_exclude ?? [])

	// NSFW radio
	let nsfw = $state(value.nsfw ?? "all")

	// Sync local state → bound `value`
	$effect(() => {
		const min_w = min_width_str !== "" ? parseInt(min_width_str, 10) : undefined
		const max_w = max_width_str !== "" ? parseInt(max_width_str, 10) : undefined
		const min_h = min_height_str !== "" ? parseInt(min_height_str, 10) : undefined
		const max_h = max_height_str !== "" ? parseInt(max_height_str, 10) : undefined

		const aspect_target = aspect_target_str !== "" ? parseFloat(aspect_target_str) : undefined
		const aspect =
			aspect_target !== undefined
				? { target: aspect_target, tolerance: aspect_tolerance[0] ?? 0.15 }
				: undefined

		const min_bytes = min_mb_str !== "" ? parseFloat(min_mb_str) * 1_000_000 : undefined
		const max_bytes = max_mb_str !== "" ? parseFloat(max_mb_str) * 1_000_000 : undefined

		value = {
			...(min_w !== undefined && !isNaN(min_w) ? { min_width: min_w } : {}),
			...(max_w !== undefined && !isNaN(max_w) ? { max_width: max_w } : {}),
			...(min_h !== undefined && !isNaN(min_h) ? { min_height: min_h } : {}),
			...(max_h !== undefined && !isNaN(max_h) ? { max_height: max_h } : {}),
			...(aspect !== undefined ? { aspect_ratio: aspect } : {}),
			...(min_bytes !== undefined && !isNaN(min_bytes)
				? { min_bytes: Math.round(min_bytes) }
				: {}),
			...(max_bytes !== undefined && !isNaN(max_bytes)
				? { max_bytes: Math.round(max_bytes) }
				: {}),
			...(selected_formats.length > 0 ? { formats: selected_formats } : {}),
			...(tags_include.length > 0 ? { tags_include } : {}),
			...(tags_exclude.length > 0 ? { tags_exclude } : {}),
			nsfw,
		}
	})

	function toggle_format(fmt: Format): void {
		if (selected_formats.includes(fmt)) {
			selected_formats = selected_formats.filter((f) => f !== fmt)
		} else {
			selected_formats = [...selected_formats, fmt]
		}
	}
</script>

<div class="space-y-6 {klass}">
	<!-- Resolution -->
	<fieldset class="space-y-3">
		<legend class="text-sm font-semibold text-[var(--fg)]">Resolution</legend>
		<div class="grid grid-cols-2 gap-3">
			<div class="space-y-1.5">
				<Label for="min-width">Min width (px)</Label>
				<Input
					id="min-width"
					type="number"
					min="1"
					placeholder="e.g. 1920"
					bind:value={min_width_str}
				/>
			</div>
			<div class="space-y-1.5">
				<Label for="max-width">Max width (px)</Label>
				<Input
					id="max-width"
					type="number"
					min="1"
					placeholder="e.g. 7680"
					bind:value={max_width_str}
				/>
			</div>
			<div class="space-y-1.5">
				<Label for="min-height">Min height (px)</Label>
				<Input
					id="min-height"
					type="number"
					min="1"
					placeholder="e.g. 1080"
					bind:value={min_height_str}
				/>
			</div>
			<div class="space-y-1.5">
				<Label for="max-height">Max height (px)</Label>
				<Input
					id="max-height"
					type="number"
					min="1"
					placeholder="e.g. 4320"
					bind:value={max_height_str}
				/>
			</div>
		</div>
	</fieldset>

	<!-- Aspect ratio -->
	<fieldset class="space-y-3">
		<legend class="text-sm font-semibold text-[var(--fg)]">Aspect ratio</legend>
		<div class="space-y-1.5">
			<Label for="aspect-target">Target (e.g. 1.78 for 16:9)</Label>
			<Input
				id="aspect-target"
				type="number"
				step="0.01"
				min="0.1"
				placeholder="e.g. 1.78"
				bind:value={aspect_target_str}
			/>
		</div>
		{#if aspect_target_str !== ""}
			<div class="space-y-1.5">
				<Label>Tolerance: ±{(aspect_tolerance[0] ?? 0.15).toFixed(2)}</Label>
				<Slider bind:value={aspect_tolerance} min={0} max={1} step={0.01} />
			</div>
		{/if}
	</fieldset>

	<!-- File size -->
	<fieldset class="space-y-3">
		<legend class="text-sm font-semibold text-[var(--fg)]">File size</legend>
		<div class="grid grid-cols-2 gap-3">
			<div class="space-y-1.5">
				<Label for="min-mb">Min size (MB)</Label>
				<Input
					id="min-mb"
					type="number"
					min="0"
					step="0.1"
					placeholder="e.g. 0.5"
					bind:value={min_mb_str}
				/>
			</div>
			<div class="space-y-1.5">
				<Label for="max-mb">Max size (MB)</Label>
				<Input
					id="max-mb"
					type="number"
					min="0"
					step="0.1"
					placeholder="e.g. 10"
					bind:value={max_mb_str}
				/>
			</div>
		</div>
	</fieldset>

	<!-- Formats -->
	<fieldset class="space-y-3">
		<legend class="text-sm font-semibold text-[var(--fg)]">Allowed formats</legend>
		<div class="flex flex-wrap gap-4">
			{#each FORMATS as fmt (fmt)}
				<div class="flex items-center gap-2">
					<Checkbox
						id="fmt-{fmt}"
						checked={selected_formats.includes(fmt)}
						onCheckedChange={() => {
							toggle_format(fmt)
						}}
					/>
					<Label for="fmt-{fmt}" class="cursor-pointer">{fmt.toUpperCase()}</Label>
				</div>
			{/each}
		</div>
	</fieldset>

	<!-- Tags -->
	<fieldset class="space-y-3">
		<legend class="text-sm font-semibold text-[var(--fg)]">Tags</legend>
		<div class="space-y-1.5">
			<Label>Include tags</Label>
			<TagsInput bind:value={tags_include} placeholder="Add included tag…" />
		</div>
		<div class="space-y-1.5">
			<Label>Exclude tags</Label>
			<TagsInput bind:value={tags_exclude} placeholder="Add excluded tag…" />
		</div>
	</fieldset>

	<!-- NSFW -->
	<fieldset class="space-y-3">
		<legend class="text-sm font-semibold text-[var(--fg)]">NSFW filter</legend>
		<RadioGroup
			bind:value={nsfw}
			onValueChange={(v) => {
				nsfw = v as DeviceFilters["nsfw"]
			}}
		>
			<div class="flex items-center gap-2">
				<RadioGroupItem value="all" id="nsfw-all" />
				<Label for="nsfw-all" class="cursor-pointer">All (SFW + NSFW + Unknown)</Label>
			</div>
			<div class="flex items-center gap-2">
				<RadioGroupItem value="sfw_only" id="nsfw-sfw" />
				<Label for="nsfw-sfw" class="cursor-pointer">SFW only</Label>
			</div>
			<div class="flex items-center gap-2">
				<RadioGroupItem value="nsfw_only" id="nsfw-nsfw" />
				<Label for="nsfw-nsfw" class="cursor-pointer">NSFW only</Label>
			</div>
		</RadioGroup>
	</fieldset>
</div>
