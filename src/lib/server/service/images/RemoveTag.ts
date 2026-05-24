import { and, eq } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import type { RemoveTagRequest, RemoveTagResponse } from "$lib/schemas/images/RemoveTag"
import { images, image_user_tags } from "$lib/server/db/schema"
import { type Constructor } from "./base"

export function RemoveTag<T extends Constructor>(Sup: T) {
	return class RemoveTag extends Sup {
		@traced()
		async removeTag(req: RemoveTagRequest): Promise<RemoveTagResponse> {
			const db = this.deps.db

			// Verify the image exists
			const image = await db.query.images.findFirst({ where: eq(images.id, req.image_id) })
			if (!image) {
				throw new AppError({
					message: `image not found: ${req.image_id}`,
					publicMessage: "Image not found.",
					status: 404,
					fields: { image_id: req.image_id },
				})
			}

			// Normalise tag: trim + lowercase
			const tag = req.tag.trim().toLowerCase()

			// Check the tag exists
			const existing = await db.query.image_user_tags.findFirst({
				where: (t, { and: dand, eq: deq }) =>
					dand(deq(t.image_id, req.image_id), deq(t.tag, tag)),
			})

			if (!existing) {
				throw new AppError({
					message: `tag not found: "${tag}" on image ${req.image_id}`,
					publicMessage: "Tag not found.",
					status: 404,
					fields: { image_id: req.image_id, tag },
				})
			}

			await db
				.delete(image_user_tags)
				.where(
					and(eq(image_user_tags.image_id, req.image_id), eq(image_user_tags.tag, tag)),
				)
				.run()

			return { success: true }
		}
	}
}
