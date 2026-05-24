import { eq } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import type { RestoreImageRequest, RestoreImageResponse } from "$lib/schemas/images/RestoreImage"
import { images } from "$lib/server/db/schema"
import { type Constructor } from "./base"
import { GetImage } from "./GetImage"

export function RestoreImage<T extends Constructor>(Sup: T) {
	return class RestoreImage extends GetImage(Sup) {
		@traced()
		async restoreImage(req: RestoreImageRequest): Promise<RestoreImageResponse> {
			const db = this.deps.db

			// Verify the image exists
			const row = await db.query.images.findFirst({ where: eq(images.id, req.id) })
			if (!row) {
				throw new AppError({
					message: `image not found: ${req.id}`,
					publicMessage: "Image not found.",
					status: 404,
					fields: { image_id: req.id },
				})
			}

			// Refuse to restore a blacklisted image — that's a separate unblacklist flow (post-MVP)
			if (row.blacklisted_at !== null) {
				throw new AppError({
					message: `cannot restore blacklisted image: ${req.id}`,
					publicMessage:
						"This image has been blacklisted and cannot be restored. Contact an administrator to unblacklist it.",
					status: 400,
					fields: { image_id: req.id },
				})
			}

			// Clear deleted_at only
			await db.update(images).set({ deleted_at: null }).where(eq(images.id, req.id)).run()

			return this.getImage({ id: req.id, include_deleted: false })
		}
	}
}
