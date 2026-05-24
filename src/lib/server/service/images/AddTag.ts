import { eq } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import type { AddTagRequest, AddTagResponse } from "$lib/schemas/images/AddTag"
import { images, image_user_tags } from "$lib/server/db/schema"
import { type Constructor } from "./base"

export function AddTag<T extends Constructor>(Sup: T) {
	return class AddTag extends Sup {
		@traced()
		async addTag(req: AddTagRequest): Promise<AddTagResponse> {
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

			if (tag.length === 0) {
				throw new AppError({
					message: "tag is empty after normalisation",
					publicMessage: "Tag must not be empty.",
					status: 400,
					fields: { tag: req.tag },
				})
			}

			const now = Date.now()

			// INSERT ON CONFLICT DO NOTHING (idempotent — duplicate returns existing row)
			await db
				.insert(image_user_tags)
				.values({ image_id: req.image_id, tag, created_at: now })
				.onConflictDoNothing()
				.run()

			// Fetch the actual row (either just inserted or existing)
			const existing = await db.query.image_user_tags.findFirst({
				where: (t, { and, eq: deq }) => and(deq(t.image_id, req.image_id), deq(t.tag, tag)),
			})

			return {
				image_id: req.image_id,
				tag,
				created_at: existing?.created_at ?? now,
			}
		}
	}
}
