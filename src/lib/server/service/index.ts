import { DeviceService } from "./devices"
import type { Dependencies } from "./base"

export class Service {
    devices: DeviceService
    constructor(deps: Dependencies) {
        this.devices = new DeviceService(deps)
    }
}


