import { eq } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import type {
	SoftDeleteImageRequest,
	SoftDeleteImageResponse,
} from "$lib/schemas/images/SoftDeleteImage"
import { images } from "$lib/server/db/schema"
import { type Constructor } from "./base"
import { GetImage } from "./GetImage"

export function SoftDeleteImage<T extends Constructor>(Sup: T) {
	return class SoftDeleteImage extends GetImage(Sup) {
		@traced()
		async softDeleteImage(req: SoftDeleteImageRequest): Promise<SoftDeleteImageResponse> {
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

			await db
				.update(images)
				.set({ deleted_at: Date.now() })
				.where(eq(images.id, req.id))
				.run()

			// TODO(009-ingest-pipeline): reconcile disk state on next crawl

			return this.getImage({ id: req.id, include_deleted: true })
		}
	}
}
