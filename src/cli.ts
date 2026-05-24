import { Command } from "commander"
import { boot } from "$lib/server/bootstrap"
import { getLogger } from "$lib/server/telemetry"
import { set_runtime } from "$lib/server/runtime"
import { parse_listen_addr } from "$lib/server/env"
import * as scheduler from "$lib/server/scheduler/cron"

// Wallrus CLI — commander entry. MVP ships `serve` only; other subcommands
// (`device …`, `subscription …`, `source list`, `run-once`) land when the
// daemon admin UDS socket exists, per `engineering/ARCHITECTURE.md` §CLI ↔ daemon.

const program = new Command()
	.name("wallrus")
	.description("Homelab wallpaper collector daemon")
	.version("0.0.0")

program
	.command("serve")
	.description("Start the long-running daemon (HTTP + scheduler)")
	.action(async () => {
		const runtime = await boot()

		// Wire the runtime singleton so hooks.server.ts and other modules can
		// reach it via runtime_ref(). Must happen before Bun.serve() starts
		// accepting connections.
		set_runtime(runtime)

		const log = getLogger()

		// Production gate: `bun run src/cli.ts serve` is production-only.
		// Local dev uses `bun run dev` (Vite-managed). Skip this gate when
		// running under test or dev mode so the CLI stays useful for smoke tests.
		if (runtime.env.WALLRUS_MODE !== "prod" && process.env.NODE_ENV !== "production") {
			log.info("dev mode — skipping Bun.serve (use `bun run dev` for local development)", {
				module: "lifecycle",
				WALLRUS_MODE: runtime.env.WALLRUS_MODE,
			})
			process.exit(0)
		}

		// Dynamically import the SvelteKit build artifact. svelte-adapter-bun
		// produces ./build/handler.js which exports `getHandler()`. If absent,
		// the operator forgot to `bun run build` first.
		//
		// The path is stored in a variable to prevent static TypeScript resolution
		// of the build artifact (which may not exist at type-check time). The
		// `any` cast in the Bun.serve call gives us freedom from build-artifact types.
		let bun_serve_opts: Record<string, unknown>
		try {
			const handler_path = new URL("../build/handler.js", import.meta.url).href
			const mod = await import(handler_path)
			bun_serve_opts = mod.getHandler()
		} catch (err) {
			const is_missing =
				err instanceof Error &&
				(err.message.includes("ENOENT") || err.message.includes("Cannot find"))
			if (is_missing) {
				log.error("missing ./build/handler.js — run `bun run build` first", {
					module: "lifecycle",
				})
			} else {
				log.error("failed to load build handler", {
					module: "lifecycle",
					error: err instanceof Error ? err.message : String(err),
				})
			}
			process.exit(1)
		}

		// Start the scheduler tick (60s interval, stub executor).
		// Does not fire immediately on boot — first tick is after 60s.
		scheduler.start(runtime)

		// Parse the listen address and start the HTTP server.
		const { hostname, port } = parse_listen_addr(runtime.env.WALLRUS_LISTEN_ADDR)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const server = Bun.serve({ port, hostname, ...(bun_serve_opts as any) })
		log.info("listening", { module: "http", hostname, port })

		// Graceful shutdown. Same body for SIGTERM and SIGINT.
		const shutdown = async (signal: string) => {
			log.info("shutdown", { module: "lifecycle", signal })
			// Hard-exit fallback — prevents hanging if something deadlocks.
			setTimeout(() => process.exit(1), 5_000).unref()
			await scheduler.stop()
			server.stop()
			await runtime.sdk.shutdown()
			runtime.db.$client.close()
			process.exit(0)
		}

		process.on("SIGTERM", () => {
			shutdown("SIGTERM").catch(() => process.exit(1))
		})
		process.on("SIGINT", () => {
			shutdown("SIGINT").catch(() => process.exit(1))
		})
	})

program.parseAsync(Bun.argv)
