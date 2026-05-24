import { eq } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import type {
	BlacklistImageRequest,
	BlacklistImageResponse,
} from "$lib/schemas/images/BlacklistImage"
import { images, favorites, image_user_tags } from "$lib/server/db/schema"
import { type Constructor } from "./base"
import { GetImage } from "./GetImage"

export function BlacklistImage<T extends Constructor>(Sup: T) {
	return class BlacklistImage extends GetImage(Sup) {
		@traced()
		async blacklistImage(req: BlacklistImageRequest): Promise<BlacklistImageResponse> {
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

			// Wrap in a transaction: set blacklisted_at + clear favorites + clear user tags
			db.transaction((tx) => {
				tx.update(images)
					.set({ blacklisted_at: Date.now() })
					.where(eq(images.id, req.id))
					.run()

				// Clear favorites for this image
				tx.delete(favorites).where(eq(favorites.image_id, req.id)).run()

				// Clear user tags for this image
				tx.delete(image_user_tags).where(eq(image_user_tags.image_id, req.id)).run()
			})

			// TODO(009-ingest-pipeline): reconcile disk state on next crawl

			return this.getImage({ id: req.id, include_deleted: true })
		}
	}
}
