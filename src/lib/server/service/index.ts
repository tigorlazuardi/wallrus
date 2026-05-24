import { DeviceService } from "./devices"
import { SubscriptionService } from "./subscriptions"
import { ImageService } from "./images"
import type { Dependencies } from "./base"

export class Service {
	devices: DeviceService
	subscriptions: SubscriptionService
	images: ImageService
	constructor(deps: Dependencies) {
		this.devices = new DeviceService(deps)
		this.subscriptions = new SubscriptionService(deps)
		this.images = new ImageService(deps)
	}
}
