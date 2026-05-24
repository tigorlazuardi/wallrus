import { eq } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import type {
	ToggleFavoriteRequest,
	ToggleFavoriteResponse,
} from "$lib/schemas/images/ToggleFavorite"
import { images, favorites } from "$lib/server/db/schema"
import { type Constructor } from "./base"
import { GetImage } from "./GetImage"

export function ToggleFavorite<T extends Constructor>(Sup: T) {
	return class ToggleFavorite extends GetImage(Sup) {
		@traced()
		async toggleFavorite(req: ToggleFavoriteRequest): Promise<ToggleFavoriteResponse> {
			const db = this.deps.db

			// Verify the image exists (GetImage will throw 404 if not found or deleted)
			const row = await db.query.images.findFirst({ where: eq(images.id, req.image_id) })
			if (!row) {
				throw new AppError({
					message: `image not found: ${req.image_id}`,
					publicMessage: "Image not found.",
					status: 404,
					fields: { image_id: req.image_id },
				})
			}

			if (req.favorited) {
				// INSERT OR IGNORE (idempotent)
				await db
					.insert(favorites)
					.values({ image_id: req.image_id, favorited_at: Date.now() })
					.onConflictDoNothing()
					.run()
			} else {
				await db.delete(favorites).where(eq(favorites.image_id, req.image_id)).run()
			}

			// Return the updated image DTO
			return this.getImage({ id: req.image_id, include_deleted: true })
		}
	}
}
