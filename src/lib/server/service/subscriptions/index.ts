import { Base } from "../base"
import { ListSubscriptions } from "./ListSubscriptions"
import { GetSubscription } from "./GetSubscription"
import { CreateSubscription } from "./CreateSubscription"
import { UpdateSubscription } from "./UpdateSubscription"
import { DeleteSubscription } from "./DeleteSubscription"
import { ToggleSubscription } from "./ToggleSubscription"
import { LinkDevice } from "./LinkDevice"
import { UnlinkDevice } from "./UnlinkDevice"
import { ListSubscriptionDevices } from "./ListSubscriptionDevices"

const Service = ListSubscriptionDevices(
	UnlinkDevice(
		LinkDevice(
			ToggleSubscription(
				DeleteSubscription(
					UpdateSubscription(
						CreateSubscription(GetSubscription(ListSubscriptions(Base))),
					),
				),
			),
		),
	),
)

export class SubscriptionService extends Service {}
