<script lang="ts">
	import { Cron } from "croner"

	interface Props {
		value?: string
		class?: string
	}

	let { value = $bindable("0 * * * *"), class: klass = "" }: Props = $props()

	type ValidationResult = { valid: true; next_runs: Date[] } | { valid: false; error: string }

	const validation: ValidationResult = $derived(
		(() => {
			if (!value || !value.trim()) {
				return { valid: false, error: "Cron expression is required." } as ValidationResult
			}
			try {
				const job = new Cron(value.trim())
				const runs: Date[] = []
				let cursor: Date | null = null
				for (let i = 0; i < 3; i++) {
					const next = job.nextRun(cursor ?? undefined)
					if (!next) break
					runs.push(next)
					cursor = next
				}
				return { valid: true, next_runs: runs } as ValidationResult
			} catch {
				return { valid: false, error: "Invalid cron expression." } as ValidationResult
			}
		})(),
	)

	function format_date(d: Date): string {
		return d.toLocaleString(undefined, {
			weekday: "short",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		})
	}
</script>

<div class="flex flex-col gap-1.5 {klass}">
	<input
		type="text"
		bind:value
		placeholder="0 * * * *"
		class="flex h-9 w-full rounded-[var(--radius)] border bg-[var(--surface)] px-3 py-1 font-mono text-sm text-[var(--fg)] shadow-sm transition-colors placeholder:text-[var(--fg-muted)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] {validation.valid
			? 'border-[var(--glass-border)]'
			: 'border-red-500'}"
	/>

	{#if !validation.valid}
		<p class="text-xs text-red-500">{validation.error}</p>
	{:else}
		<div class="space-y-0.5">
			<p class="text-xs font-medium text-[var(--fg-muted)]">Next 3 runs:</p>
			{#each validation.next_runs as run, i (i)}
				<p class="text-xs text-[var(--fg)]">{format_date(run)}</p>
			{/each}
		</div>
	{/if}
</div>
