// @ts-check
import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"

// Project pages deploy: https://<owner>.github.io/wallrus/
// `site` + `base` produce correct asset URLs under the /wallrus/ subpath.
// Override these via env if forking under a different owner / repo name.
const SITE = process.env.WALLRUS_DOCS_SITE ?? "https://tigorlazuardi.github.io"
const BASE = process.env.WALLRUS_DOCS_BASE ?? "/wallrus"

export default defineConfig({
	site: SITE,
	base: BASE,
	trailingSlash: "always",
	// Both locales prefixed → no page at the base; redirect to /en/.
	redirects: {
		"/": "/en/",
	},
	integrations: [
		starlight({
			title: {
				en: "wallrus",
				id: "wallrus",
			},
			description: "Homelab wallpaper collector — user guide",
			defaultLocale: "en",
			locales: {
				en: { label: "English", lang: "en" },
				id: { label: "Bahasa Indonesia", lang: "id" },
			},
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/tigorlazuardi/wallrus",
				},
			],
			sidebar: [
				{
					label: "Getting started",
					translations: { id: "Memulai" },
					items: [
						{ slug: "getting-started", label: "Overview", translations: { id: "Ringkasan" } },
						{ slug: "install", label: "Install", translations: { id: "Instalasi" } },
					],
				},
				{
					label: "Configuration",
					translations: { id: "Konfigurasi" },
					items: [
						{
							slug: "configuration/env",
							label: "Environment variables",
							translations: { id: "Variabel lingkungan" },
						},
						{
							slug: "configuration/auth",
							label: "Auth",
							translations: { id: "Autentikasi" },
						},
						{
							slug: "configuration/docker",
							label: "Docker",
							translations: { id: "Docker" },
						},
					],
				},
			],
		}),
	],
})
