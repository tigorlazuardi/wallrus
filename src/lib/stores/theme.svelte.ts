export type Theme = "light" | "dark" | "system"

const STORAGE_KEY = "wallrus.theme"

function get_resolved(theme: Theme): "light" | "dark" {
	if (theme === "system") {
		if (typeof window === "undefined") return "light"
		return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
	}
	return theme
}

function apply(resolved: "light" | "dark"): void {
	if (typeof document !== "undefined") {
		document.documentElement.dataset.theme = resolved
	}
}

function read_stored(): Theme {
	if (typeof localStorage === "undefined") return "system"
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (raw === "light" || raw === "dark" || raw === "system") return raw
	} catch {
		// locked-down browser
	}
	return "system"
}

function write_stored(theme: Theme): void {
	if (typeof localStorage === "undefined") return
	try {
		localStorage.setItem(STORAGE_KEY, theme)
	} catch {
		// locked-down browser
	}
}

class ThemeStore {
	#current: Theme = $state("system")

	constructor() {
		if (typeof window !== "undefined") {
			this.#current = read_stored()
			apply(get_resolved(this.#current))

			// Re-apply on system preference change
			window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
				if (this.#current === "system") {
					apply(get_resolved("system"))
				}
			})
		}
	}

	get current(): Theme {
		return this.#current
	}

	set(theme: Theme): void {
		this.#current = theme
		write_stored(theme)
		apply(get_resolved(theme))
	}

	cycle(): void {
		const order: readonly Theme[] = ["light", "dark", "system"]
		const idx = order.indexOf(this.#current)
		const next: Theme = order[(idx + 1) % order.length] ?? "light"
		this.set(next)
	}
}

export const themeStore = new ThemeStore()
