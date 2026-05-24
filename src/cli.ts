import { Command } from "commander"
import { boot } from "$lib/server/bootstrap"

// Wallrus CLI — commander entry. MVP ships `serve` only; other subcommands
// (`device …`, `subscription …`, `source list`, `run-once`) land when the
// daemon admin UDS socket exists, per `docs/ARCHITECTURE.md` §CLI ↔ daemon.

const program = new Command()
	.name("wallrus")
	.description("Homelab wallpaper collector daemon")
	.version("0.0.0")

program
	.command("serve")
	.description("Start the long-running daemon (HTTP + scheduler)")
	.action(async () => {
		const runtime = boot()
		console.log(`✓ wallrus serve — data_dir=${runtime.env.WALLRUS_DATA_DIR}`)
		// HTTP server + scheduler tick land in subsequent commits.
		// For now this exits after bootstrap so migrations are validated end-to-end.
	})

program.parseAsync(Bun.argv)
