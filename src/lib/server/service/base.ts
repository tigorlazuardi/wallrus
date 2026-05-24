import type { DbClient } from "$lib/server/db/client"

export type Dependencies = {
	db: DbClient
}

export class Base {
	protected deps: Dependencies
	constructor(deps: Dependencies) {
		this.deps = deps
	}
}

export type Constructor<T extends Base = Base> = new (...args: any[]) => T
