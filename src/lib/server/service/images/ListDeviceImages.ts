import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import type {
	ListDeviceImagesRequest,
	ListDeviceImagesResponse,
} from "$lib/schemas/images/ListDeviceImages"
import type { ListImagesRequest, ListImagesResponse } from "$lib/schemas/images/ListImages"
import { type Constructor } from "./base"

export function ListDeviceImages<T extends Constructor>(Sup: T) {
	return class ListDeviceImages extends Sup {
		@traced()
		async listDeviceImages(req: ListDeviceImagesRequest): Promise<ListDeviceImagesResponse> {
			// Cast to access listImages, which is provided earlier in the mixin chain (ListImages)
			const self = this as unknown as {
				listImages(req: ListImagesRequest): Promise<ListImagesResponse>
			}
			return self.listImages({
				...req,
				device_id: req.device_id,
			})
		}
	}
}
