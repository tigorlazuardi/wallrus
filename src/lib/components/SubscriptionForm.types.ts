/**
 * Shared types for SubscriptionForm. Extracted to a plain .ts file so that
 * plain `tsc --noEmit` (the lefthook gate) can see them without the Svelte
 * compiler plugin.
 *
 * `ParamDescriptor` is the canonical type from the universal schema module
 * so that both the server (params_descriptor.ts) and the client (SubscriptionForm)
 * use the same definition with no drift.
 */

export type { ParamDescriptor } from "$lib/schemas/sources/ListSources"
