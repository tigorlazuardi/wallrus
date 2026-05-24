/**
 * SSE client wrapper for /api/v1/runs/stream.
 *
 * Opens an EventSource, parses run.update events, and calls the provided
 * callback with each parsed Run DTO. Reconnects with exponential backoff
 * (1s, 2s, 4s). After 3 failed reconnects, falls back to polling
 * GET /api/v1/runs/active every 10 seconds.
 */
import type { Run } from "$lib/schemas/runs/Run"

export type RunUpdateEvent = Run

type Deps = {
	EventSource: typeof EventSource
	fetch: (url: string) => Promise<Response>
	setInterval: (cb: () => void, delay: number) => number
	clearInterval: (id: number) => void
	setTimeout: (cb: () => void, delay: number) => number
	clearTimeout: (id: number) => void
}

const DEFAULT_DEPS: Deps = {
	EventSource: globalThis.EventSource,
	fetch: (url: string) => globalThis.fetch(url),
	setInterval: (cb, delay) => globalThis.setInterval(cb, delay) as unknown as number,
	clearInterval: (id) =>
		globalThis.clearInterval(id as unknown as Parameters<typeof clearInterval>[0]),
	setTimeout: (cb, delay) => globalThis.setTimeout(cb, delay) as unknown as number,
	clearTimeout: (id) =>
		globalThis.clearTimeout(id as unknown as Parameters<typeof clearTimeout>[0]),
}

const SSE_URL = "/api/v1/runs/stream"
const POLL_URL = "/api/v1/runs/active"
const BACKOFF_DELAYS = [1_000, 2_000, 4_000]
const POLL_INTERVAL = 10_000

/**
 * Subscribe to run update events.
 *
 * @param callback - Called with each incoming RunUpdateEvent.
 * @param deps - Injectable timer/fetch deps (for testing).
 * @returns Cleanup function — call it to disconnect and stop polling.
 */
export function subscribe(
	callback: (event: RunUpdateEvent) => void,
	deps: Deps = DEFAULT_DEPS,
): () => void {
	let es: InstanceType<typeof EventSource> | null = null
	let reconnect_count = 0
	let reconnect_timer: number | null = null
	let poll_timer: number | null = null
	let stopped = false

	function cleanup() {
		stopped = true
		if (reconnect_timer !== null) {
			deps.clearTimeout(reconnect_timer)
			reconnect_timer = null
		}
		if (poll_timer !== null) {
			deps.clearInterval(poll_timer)
			poll_timer = null
		}
		if (es !== null) {
			es.close()
			es = null
		}
	}

	async function fetch_active() {
		try {
			const resp = await deps.fetch(POLL_URL)
			if (!resp.ok) return
			const data = (await resp.json()) as { items: Run[] }
			if (Array.isArray(data?.items)) {
				for (const run of data.items) {
					callback(run)
				}
			}
		} catch {
			// Polling failures are silent — we'll retry on next interval
		}
	}

	function start_polling() {
		if (stopped || poll_timer !== null) return
		// Immediate first poll
		void fetch_active()
		poll_timer = deps.setInterval(() => {
			void fetch_active()
		}, POLL_INTERVAL)
	}

	function connect() {
		if (stopped) return

		es = new deps.EventSource(SSE_URL)

		es.addEventListener("run.update", (e: MessageEvent) => {
			// Successful event — reset reconnect counter
			reconnect_count = 0
			try {
				const run = JSON.parse(e.data) as RunUpdateEvent
				callback(run)
			} catch {
				// Malformed data — ignore
			}
		})

		es.onerror = () => {
			if (stopped) return
			es?.close()
			es = null

			reconnect_count++

			if (reconnect_count > BACKOFF_DELAYS.length) {
				// Exhausted all retries → fall back to polling
				start_polling()
				return
			}

			const delay =
				BACKOFF_DELAYS[reconnect_count - 1] ??
				BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1] ??
				4_000
			reconnect_timer = deps.setTimeout(() => {
				reconnect_timer = null
				if (!stopped) connect()
			}, delay)
		}
	}

	connect()

	return cleanup
}
