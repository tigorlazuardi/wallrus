import { sveltekit } from "@sveltejs/kit/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, type Plugin } from "vite"

// Pre-transpile service files with Bun's transpiler so `@traced()` decorators
// are lowered before Vite's Rolldown-based transformer sees them. Vite 8
// dropped esbuild for source transforms in favor of Rolldown, which does NOT
// lower legacy TS decorators. Without this plugin, JavaScriptCore's
// AsyncFunction parser (used by the SSR module-runner) rejects the raw `@`
// token at parse time and every server route 500s under `bun run dev`.
//
// Scoped narrowly: only touches files whose source contains `@traced(` to
// keep Vite's normal Rolldown pipeline owning everything else.
function bun_transpile_decorators(): Plugin {
	return {
		name: "wallrus:bun-transpile-decorators",
		enforce: "pre",
		transform(code, id) {
			if (!/\.ts$/.test(id)) return null
			if (!code.includes("@traced")) return null
			const transpiler = new Bun.Transpiler({ loader: "ts", target: "node" })
			return { code: transpiler.transformSync(code), map: null }
		},
	}
}

export default defineConfig({
	plugins: [bun_transpile_decorators(), tailwindcss(), sveltekit()],
	server: {
		port: 5173,
		host: "127.0.0.1",
	},
})
