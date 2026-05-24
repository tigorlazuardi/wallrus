<script lang="ts">
	import { Switch as SwitchPrimitive } from "bits-ui"

	interface Props {
		checked?: boolean
		disabled?: boolean
		class?: string
		id?: string
		onCheckedChange?: (checked: boolean) => void
	}

	let {
		checked = $bindable(false),
		disabled = false,
		class: klass = "",
		id,
		onCheckedChange,
	}: Props = $props()
</script>

<SwitchPrimitive.Root
	bind:checked
	{disabled}
	{id}
	{onCheckedChange}
	class="peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--accent)] data-[state=unchecked]:bg-[var(--surface-hi)] {klass}"
>
	<SwitchPrimitive.Thumb
		class="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
	/>
</SwitchPrimitive.Root>
