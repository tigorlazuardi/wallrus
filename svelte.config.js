import adapterBun from "svelte-adapter-bun"
import adapterStatic from "@sveltejs/adapter-static"
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte"

const useStatic = process.env.WALLRUS_ADAPTER === "static"

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: useStatic
			? adapterStatic({
					fallback: "index.html",
					pages: "build-mobile",
					assets: "build-mobile",
				})
			: adapterBun(),
		alias: {
			$lib: "./src/lib",
			$test: "./src/test",
		},
	},
}

export default config
