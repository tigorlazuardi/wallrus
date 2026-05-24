import { DeviceService } from "./devices"
import { SubscriptionService } from "./subscriptions"
import type { Dependencies } from "./base"

export class Service {
	devices: DeviceService
	subscriptions: SubscriptionService
	constructor(deps: Dependencies) {
		this.devices = new DeviceService(deps)
		this.subscriptions = new SubscriptionService(deps)
	}
}
