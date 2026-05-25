<script lang="ts">
	import type { DeviceFilters } from "$lib/schemas/devices/DeviceFilters"
	import { Input } from "$lib/components/ui/input"
	import { Label } from "$lib/components/ui/label"
	import { Checkbox } from "$lib/components/ui/checkbox"
	import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group"
	import TagsInput from "./TagsInput.svelte"

	const FORMATS = ["jpg", "png", "webp", "avif"] as const
	type Format = (typeof FORMATS)[number]

	interface Props {
		value?: DeviceFilters
		/** Device's native width in pixels — used to auto-derive AR target. */
		native_width?: number | null
		/** Device's native height in pixels — used to auto-derive AR target. */
		native_height?: number | null
		/**
		 * Initialize the AR dirty flag.
		 * true = preserve existing target (use on edit when target already set).
		 * false = allow native-res auto-derive (use on new device).
		 */
		ar_target_dirty_init?: boolean
		class?: string
	}

	let {
		value = $bindable({
			nsfw: "all",
		}),
		native_width = $bindable(null),
		native_height = $bindable(null),
		ar_target_dirty_init = false,
		class: klass = "",
	}: Props = $props()

	// Native resolution strings (for input binding)
	let native_width_str = $state(native_width != null ? String(native_width) : "")
	let native_height_str = $state(native_height != null ? String(native_height) : "")

	// Resolution inputs — convert undefined ↔ "" for input binding
	let min_width_str = $state(value.min_width !== undefined ? String(value.min_width) : "")
	let max_width_str = $state(value.max_width !== undefined ? String(value.max_width) : "")
	let min_height_str = $state(value.min_height !== undefined ? String(value.min_height) : "")
	let max_height_str = $state(value.max_height !== undefined ? String(value.max_height) : "")

	// Aspect ratio inputs
	let aspect_target_str = $state(
		value.aspect_ratio !== undefined ? String(value.aspect_ratio.target) : "",
	)
	let aspect_tolerance_str = $state(
		value.aspect_ratio !== undefined ? String(value.aspect_ratio.tolerance) : "",
	)

	// AR auto-derive dirty flag: true if user has manually typed the target
	let ar_target_dirty = $state(ar_target_dirty_init)

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

	// AR auto-derive: when native_width + native_height are set and target not dirtied
	$effect(() => {
		const w = native_width_str !== "" ? parseInt(native_width_str, 10) : null
		const h = native_height_str !== "" ? parseInt(native_height_str, 10) : null
		if (w !== null && h !== null && !isNaN(w) && !isNaN(h) && h > 0 && !ar_target_dirty) {
			aspect_target_str = parseFloat((w / h).toFixed(4)).toString()
		}
	})

	// Sync native resolution strings → bound `native_width` / `native_height` props
	$effect(() => {
		const w = native_width_str !== "" ? parseInt(native_width_str, 10) : null
		native_width = w !== null && !isNaN(w) ? w : null
	})

	$effect(() => {
		const h = native_height_str !== "" ? parseInt(native_height_str, 10) : null
		native_height = h !== null && !isNaN(h) ? h : null
	})

	// Sync local state → bound `value`
	$effect(() => {
		const min_w = min_width_str !== "" ? parseInt(min_width_str, 10) : undefined
		const max_w = max_width_str !== "" ? parseInt(max_width_str, 10) : undefined
		const min_h = min_height_str !== "" ? parseInt(min_height_str, 10) : undefined
		const max_h = max_height_str !== "" ? parseInt(max_height_str, 10) : undefined

		const aspect_target = aspect_target_str !== "" ? parseFloat(aspect_target_str) : undefined
		const tolerance_val =
			aspect_tolerance_str !== "" ? parseFloat(aspect_tolerance_str) : undefined
		const aspect =
			aspect_target !== undefined
				? {
						target: aspect_target,
						tolerance:
							tolerance_val !== undefined && !isNaN(tolerance_val)
								? tolerance_val
								: 0,
					}
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

	function handle_ar_target_input(e: Event) {
		const target = e.target as HTMLInputElement
		aspect_target_str = target.value
		ar_target_dirty = true
		// Default-populate tolerance to 0.1 on first target edit if tolerance is empty/0
		if (aspect_tolerance_str === "" || parseFloat(aspect_tolerance_str) === 0) {
			aspect_tolerance_str = "0.1"
		}
	}
</script>

<div class="space-y-6 {klass}">
	<!-- Native resolution (for AR auto-derive) -->
	<fieldset class="space-y-3">
		<legend class="text-sm font-semibold text-[var(--color-fg)]">Native resolution</legend>
		<p class="text-xs text-[var(--color-fg-muted)]">
			Used to auto-derive AR target below. Leave empty if unknown.
		</p>
		<div class="grid grid-cols-2 gap-3">
			<div class="space-y-1.5">
				<Label for="native-width">Width (px)</Label>
				<Input
					id="native-width"
					type="number"
					min="1"
					max="32768"
					placeholder="e.g. 1440"
					bind:value={native_width_str}
				/>
			</div>
			<div class="space-y-1.5">
				<Label for="native-height">Height (px)</Label>
				<Input
					id="native-height"
					type="number"
					min="1"
					max="32768"
					placeholder="e.g. 3120"
					bind:value={native_height_str}
				/>
			</div>
		</div>
	</fieldset>

	<!-- Resolution (acceptance filter) -->
	<fieldset class="space-y-3">
		<legend class="text-sm font-semibold text-[var(--color-fg)]">Resolution</legend>
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
		<legend class="text-sm font-semibold text-[var(--color-fg)]">Aspect ratio</legend>
		<div class="grid grid-cols-2 gap-3">
			<div class="space-y-1.5">
				<Label for="aspect-target">Target (auto from native res)</Label>
				<Input
					id="aspect-target"
					type="number"
					step="0.0001"
					min="0.1"
					placeholder="e.g. 1.7778"
					value={aspect_target_str}
					oninput={handle_ar_target_input}
				/>
			</div>
			<div class="space-y-1.5">
				<Label for="aspect-tolerance">Tolerance (± fraction)</Label>
				<Input
					id="aspect-tolerance"
					type="number"
					step="0.01"
					min="0"
					max="1"
					placeholder="0.10"
					bind:value={aspect_tolerance_str}
				/>
			</div>
		</div>
		<p class="text-xs text-[var(--color-fg-muted)]">
			Image AR must be within target × (1 ± tolerance). e.g. target 1.78, tolerance 0.1 →
			accepts 1.60–1.96.
		</p>
	</fieldset>

	<!-- File size -->
	<fieldset class="space-y-3">
		<legend class="text-sm font-semibold text-[var(--color-fg)]">File size</legend>
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
		<legend class="text-sm font-semibold text-[var(--color-fg)]">Allowed formats</legend>
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
		<legend class="text-sm font-semibold text-[var(--color-fg)]">Tags</legend>
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
		<legend class="text-sm font-semibold text-[var(--color-fg)]">NSFW filter</legend>
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
