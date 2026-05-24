import { DeviceService } from "./devices"
import { SubscriptionService } from "./subscriptions"
import { ImageService } from "./images"
import { RunService } from "./runs"
import type { Dependencies } from "./base"

export class Service {
	devices: DeviceService
	subscriptions: SubscriptionService
	images: ImageService
	runs: RunService
	constructor(deps: Dependencies) {
		this.devices = new DeviceService(deps)
		this.subscriptions = new SubscriptionService(deps)
		this.images = new ImageService(deps)
		this.runs = new RunService(deps)
	}
}
