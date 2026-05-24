<script lang="ts">
	import type { Run } from "$lib/schemas/runs/Run"

	interface Props {
		status: Run["status"]
		stop_reason?: Run["stop_reason"]
		class?: string
	}

	let { status, stop_reason, class: className = "" }: Props = $props()

	type ColorConfig = {
		bg: string
		text: string
		border: string
		pulse: boolean
		label: string
	}

	const c = $derived<ColorConfig>(
		status === "running"
			? {
					bg: "rgb(37 99 235 / 0.2)",
					text: "rgb(147 197 253)",
					border: "rgb(59 130 246 / 0.4)",
					pulse: true,
					label: "Running",
				}
			: status === "success"
				? {
						bg: "rgb(22 163 74 / 0.2)",
						text: "rgb(134 239 172)",
						border: "rgb(34 197 94 / 0.4)",
						pulse: false,
						label: "Success",
					}
				: {
						bg: "rgb(220 38 38 / 0.2)",
						text: "rgb(252 165 165)",
						border: "rgb(239 68 68 / 0.4)",
						pulse: false,
						label: stop_reason === "daemon_crash" ? "Daemon Crash" : "Failed",
					},
	)
</script>

<span
	class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold {className}"
	style="background: {c.bg}; color: {c.text}; border-color: {c.border};"
	aria-label="Run status: {c.label}"
>
	{#if c.pulse}
		<span
			class="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
			style="background: {c.text};"
		></span>
	{/if}
	{c.label}
</span>
