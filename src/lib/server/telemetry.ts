// Telemetry wiring. Wraps `@tigorhutasuhut/telemetry-js` so the rest of the
// codebase imports a single `telemetry` namespace. Pretty stdout on TTY,
// JSON otherwise; OTEL emission enabled when WALLRUS_OTEL_ENDPOINT is set.
//
// This is intentionally a thin re-export for now. Detailed wiring (spans,
// metric counters, log redaction of Authorization / Cookie / auth-route POST
// bodies) lands when the surfaces that need them ship.

export * as telemetry from "@tigorhutasuhut/telemetry-js/bun"
