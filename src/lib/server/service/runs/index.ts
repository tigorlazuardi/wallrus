import { Base } from "../base"
import { ListRuns } from "./ListRuns"
import { GetRun } from "./GetRun"
import { ListSubscriptionRuns } from "./ListSubscriptionRuns"
import { GetActiveRuns } from "./GetActiveRuns"

// Composition order (outer → inner):
//   ListSubscriptionRuns delegates to listRuns, so it must be composed AFTER ListRuns.
const Service = ListSubscriptionRuns(GetActiveRuns(GetRun(ListRuns(Base))))

export class RunService extends Service {}
