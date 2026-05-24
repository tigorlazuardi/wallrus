import { Base } from "../base"
import { ListImages } from "./ListImages"
import { GetImage } from "./GetImage"
import { ListDeviceImages } from "./ListDeviceImages"
import { ToggleFavorite } from "./ToggleFavorite"
import { AddTag } from "./AddTag"
import { RemoveTag } from "./RemoveTag"
import { SoftDeleteImage } from "./SoftDeleteImage"
import { BlacklistImage } from "./BlacklistImage"
import { RestoreImage } from "./RestoreImage"

// Compose all operation mixins.
// Note: some mixins internally compose GetImage themselves (ToggleFavorite, SoftDeleteImage,
// BlacklistImage, RestoreImage), but the domain index still lists the standalone GetImage
// mixin so it's consistently accessible.
const Service = RestoreImage(
	BlacklistImage(
		SoftDeleteImage(
			RemoveTag(AddTag(ToggleFavorite(ListDeviceImages(GetImage(ListImages(Base)))))),
		),
	),
)

export class ImageService extends Service {}
