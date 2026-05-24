import { and, asc, desc, eq, gt, lt, or, sql } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import type {
	ListSubscriptionDevicesRequest,
	ListSubscriptionDevicesResponse,
} from "$lib/schemas/subscriptions/ListSubscriptionDevices"
import { device_subscriptions, devices } from "$lib/server/db/schema"
import { to_device_dto } from "$lib/server/service/devices/base"
import { encode_cursor, decode_cursor } from "$lib/server/http/pagination"
import { type Constructor } from "./base"

// Column selection for devices in the join query
const device_cols = {
	id: devices.id,
	slug: devices.slug,
	name: devices.name,
	enabled: devices.enabled,
	filter_criteria: devices.filter_criteria,
	created_at: devices.created_at,
}

type DeviceRow = typeof devices.$inferSelect

export function ListSubscriptionDevices<T extends Constructor>(Sup: T) {
	return class ListSubscriptionDevices extends Sup {
		@traced()
		async listSubscriptionDevices(
			req: ListSubscriptionDevicesRequest,
		): Promise<ListSubscriptionDevicesResponse> {
			const db = this.deps.db
			const limit = req.limit
			const offset = req.offset

			// Count total devices for this subscription
			const total_result = await withQueryName("subscriptions.devices.count", () =>
				db
					.select({ count: sql<number>`COUNT(*)` })
					.from(device_subscriptions)
					.innerJoin(devices, eq(device_subscriptions.device_id, devices.id))
					.where(eq(device_subscriptions.subscription_id, req.subscription_id)),
			)
			const total = total_result[0]?.count ?? 0

			const sub_filter = eq(device_subscriptions.subscription_id, req.subscription_id)

			let rows: DeviceRow[]

			if (req.next) {
				const cursor = decode_cursor(req.next)
				if (cursor) {
					const cursor_where = or(
						lt(devices.created_at, cursor.created_at),
						and(eq(devices.created_at, cursor.created_at), lt(devices.id, cursor.id)),
					)
					rows = (await withQueryName("subscriptions.devices.list", () =>
						db
							.select(device_cols)
							.from(device_subscriptions)
							.innerJoin(devices, eq(device_subscriptions.device_id, devices.id))
							.where(and(sub_filter, cursor_where))
							.orderBy(desc(devices.created_at), desc(devices.id))
							.limit(limit)
							.offset(offset),
					)) as DeviceRow[]
				} else {
					rows = (await withQueryName("subscriptions.devices.list", () =>
						db
							.select(device_cols)
							.from(device_subscriptions)
							.innerJoin(devices, eq(device_subscriptions.device_id, devices.id))
							.where(sub_filter)
							.orderBy(desc(devices.created_at), desc(devices.id))
							.limit(limit)
							.offset(offset),
					)) as DeviceRow[]
				}
			} else if (req.prev) {
				const cursor = decode_cursor(req.prev)
				if (cursor) {
					const cursor_where = or(
						gt(devices.created_at, cursor.created_at),
						and(eq(devices.created_at, cursor.created_at), gt(devices.id, cursor.id)),
					)
					const raw = (await withQueryName("subscriptions.devices.list", () =>
						db
							.select(device_cols)
							.from(device_subscriptions)
							.innerJoin(devices, eq(device_subscriptions.device_id, devices.id))
							.where(and(sub_filter, cursor_where))
							.orderBy(asc(devices.created_at), asc(devices.id))
							.limit(limit)
							.offset(offset),
					)) as DeviceRow[]
					rows = raw.reverse()
				} else {
					rows = (await withQueryName("subscriptions.devices.list", () =>
						db
							.select(device_cols)
							.from(device_subscriptions)
							.innerJoin(devices, eq(device_subscriptions.device_id, devices.id))
							.where(sub_filter)
							.orderBy(desc(devices.created_at), desc(devices.id))
							.limit(limit)
							.offset(offset),
					)) as DeviceRow[]
				}
			} else {
				rows = (await withQueryName("subscriptions.devices.list", () =>
					db
						.select(device_cols)
						.from(device_subscriptions)
						.innerJoin(devices, eq(device_subscriptions.device_id, devices.id))
						.where(sub_filter)
						.orderBy(desc(devices.created_at), desc(devices.id))
						.limit(limit)
						.offset(offset),
				)) as DeviceRow[]
			}

			const items = rows.map(to_device_dto)
			const first_row = rows[0]
			const last_row = rows[rows.length - 1]

			const next_cursor =
				first_row != null && last_row != null
					? encode_cursor({ created_at: last_row.created_at, id: last_row.id })
					: undefined

			const prev_cursor =
				first_row != null && last_row != null
					? encode_cursor({ created_at: first_row.created_at, id: first_row.id })
					: undefined

			return { items, total, next_cursor, prev_cursor }
		}
	}
}
