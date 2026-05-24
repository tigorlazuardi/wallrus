<script lang="ts">
	import type { Run } from "$lib/schemas/runs/Run"

	interface Props {
		statuses: Array<Run["status"]>
		width?: number
		height?: number
		gap?: number
		class?: string
	}

	let { statuses, width = 120, height = 24, gap = 2, class: className = "" }: Props = $props()

	const MAX_BARS = 12

	// Take the last MAX_BARS statuses
	const visible = $derived(statuses.slice(-MAX_BARS))

	const bar_width = $derived(
		visible.length > 0
			? (width - gap * (visible.length - 1)) / visible.length
			: width / MAX_BARS,
	)

	const color: Record<Run["status"], string> = {
		running: "rgb(59 130 246)",
		success: "rgb(34 197 94)",
		failed: "rgb(239 68 68)",
	}

	const label: Record<Run["status"], string> = {
		running: "running",
		success: "success",
		failed: "failed",
	}
</script>

<svg
	{width}
	{height}
	viewBox="0 0 {width} {height}"
	class={className}
	aria-label="Run history sparkline"
	role="img"
>
	{#each visible as status, i (i)}
		<rect
			x={i * (bar_width + gap)}
			y={0}
			width={bar_width}
			{height}
			rx="2"
			fill={color[status]}
			opacity="0.8"
			aria-label={label[status]}
		/>
	{/each}
</svg>
