import { copyFileSync, linkSync } from "node:fs"

// Hardlink with cross-filesystem fallback to copy. See
// `.claude/rules/scope.md` §Storage and path scheme.
export function link_or_copy(src: string, dst: string) {
	try {
		linkSync(src, dst)
	} catch (e) {
		const code = (e as NodeJS.ErrnoException).code
		if (code === "EXDEV") {
			copyFileSync(src, dst)
			return
		}
		throw e
	}
}
