/**
 * DeviceServiceBase — the root class extended by all device operation mixins.
 *
 * Thin re-export of the global Base class. Device-specific shared helpers
 * (to_dto, etc.) can be added here as the domain grows.
 */
import type { DbClient } from "$lib/server/db/client"
import { devices } from "$lib/server/db/schema"
import type { Device } from "$lib/schemas/devices/Device"
import { Base, type Constructor, type Dependencies } from "../base"

export { Base, type Constructor, type Dependencies }
export type { DbClient }

/** Convert a raw Drizzle `devices` row to a Device DTO. */
export function to_device_dto(row: typeof devices.$inferSelect): Device {
	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		enabled: row.enabled,
		filter_criteria: row.filter_criteria,
		native_width: row.native_width ?? undefined,
		native_height: row.native_height ?? undefined,
		created_at: row.created_at,
	}
}
