import type { RequestEvent } from "@sveltejs/kit"
import type { RunHistoryRow } from "$lib/server/db/schema"
import { subscribe } from "$lib/server/runs/bus"

/**
 * GET /api/v1/runs/stream
 * Server-Sent Events endpoint. Emits `run.update` events whenever the ingest
 * pipeline writes a counter or status change to a run_history row.
 * Also emits a `: ping` keepalive comment every 15 seconds.
 */
export function GET({ request }: RequestEvent) {
	const stream = new ReadableStream({
		start(controller) {
			const enc = new TextEncoder()

			const send = (run: RunHistoryRow) =>
				controller.enqueue(
					enc.encode(`event: run.update\ndata: ${JSON.stringify(run)}\n\n`),
				)

			const ping = setInterval(() => controller.enqueue(enc.encode(`: ping\n\n`)), 15_000)

			const unsub = subscribe(send)

			request.signal.addEventListener("abort", () => {
				clearInterval(ping)
				unsub()
				try {
					controller.close()
				} catch {
					// already closed — ignore
				}
			})
		},
	})

	return new Response(stream, {
		headers: {
			"content-type": "text/event-stream",
			"cache-control": "no-cache",
			connection: "keep-alive",
		},
	})
}
