import { eq, sql } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import type { GetImageRequest, GetImageResponse } from "$lib/schemas/images/GetImage"
import { favorites } from "$lib/server/db/schema"
import { type Constructor, type ImageRow, images, to_image_dto, fetch_tags_user } from "./base"

export function GetImage<T extends Constructor>(Sup: T) {
	return class GetImage extends Sup {
		@traced()
		async getImage(req: GetImageRequest): Promise<GetImageResponse> {
			const db = this.deps.db

			const rows = await withQueryName("images.get", () =>
				db
					.select({
						id: images.id,
						sha256: images.sha256,
						source_slug: images.source_slug,
						source_id: images.source_id,
						source_url: images.source_url,
						image_url: images.image_url,
						title: images.title,
						filename: images.filename,
						width: images.width,
						height: images.height,
						file_size: images.file_size,
						format: images.format,
						nsfw: images.nsfw,
						tags_source: images.tags_source,
						search_text: images.search_text,
						created_at_source: images.created_at_source,
						ingested_at: images.ingested_at,
						deleted_at: images.deleted_at,
						blacklisted_at: images.blacklisted_at,
						aspect_ratio: images.aspect_ratio,
						favorited: sql<number>`(${favorites.image_id} IS NOT NULL)`,
					})
					.from(images)
					.leftJoin(favorites, eq(favorites.image_id, images.id))
					.where(eq(images.id, req.id))
					.limit(1),
			)

			const row = rows[0] as ImageRow | undefined

			if (!row) {
				throw new AppError({
					message: `image not found: ${req.id}`,
					publicMessage: "Image not found.",
					status: 404,
					fields: { image_id: req.id },
				})
			}

			// 404 if soft-deleted and not explicitly including deleted
			if (row.deleted_at !== null && !req.include_deleted) {
				throw new AppError({
					message: `image is soft-deleted: ${req.id}`,
					publicMessage: "Image not found.",
					status: 404,
					fields: { image_id: req.id },
				})
			}

			const tags_user = await fetch_tags_user(db, req.id)

			return to_image_dto(row, tags_user)
		}
	}
}
