import { type Constructor } from "../base"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import type { ListDevicesRequest, ListDevicesResponse } from "$lib/schemas/devices/ListDevices"

export function ListDevices<T extends Constructor>(Base: T) {
	return class ListDevices extends Base {
		@traced()
		async listDevices(req: ListDevicesRequest): Promise<ListDevicesResponse> {
			throw new Error("unimplemented")
		}
	}
}
