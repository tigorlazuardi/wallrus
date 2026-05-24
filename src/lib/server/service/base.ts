import { DeviceService } from "./devices"

export type Dependencies = {}

export class Base {
    constructor(deps: Dependencies) {
    }
}

export type Constructor<T extends Base = Base> = new (...args: any[]) => T
