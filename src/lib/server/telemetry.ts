// Telemetry surface for the rest of the codebase. Importers ALWAYS go through
// `$lib/server/telemetry` so the bindings can be swapped in tests and so a
// single module owns the contract documented in `.claude/rules/telemetry.md`.
//
// Detailed SDK init (initSDK) is wired from `bootstrap.ts` to keep this module
// import-time-pure (no side effects on import — important for unit tests).

export { getLogger, traced, withTrace, initSDK } from "@tigorhutasuhut/telemetry-js/bun"
export type { Logger } from "@tigorhutasuhut/telemetry-js/bun"
export { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
export { AppError } from "@tigorhutasuhut/telemetry-js/error"
