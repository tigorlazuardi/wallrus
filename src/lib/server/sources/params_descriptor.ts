import type { z } from "zod"
import type { ParamDescriptor } from "$lib/schemas/sources/ListSources"

// Zod v4 internal shape type (accessed via _zod.def)
interface ZodV4Def {
	type: string
	innerType?: ZodV4Schema
	element?: ZodV4Schema
	defaultValue?: unknown
	entries?: Record<string, string>
	shape?: Record<string, ZodV4Schema>
}

interface ZodV4Schema {
	_zod?: { def: ZodV4Def }
	shape?: Record<string, ZodV4Schema>
}

/**
 * Serialize a Zod object schema's fields into a flat list of ParamDescriptors
 * suitable for rendering a dynamic param form in the browser.
 *
 * Handles: ZodString, ZodNumber, ZodBoolean, ZodEnum, ZodArray(ZodString),
 * ZodDefault (unwrapped), ZodOptional (unwrapped).
 *
 * Uses Zod v4 internal `_zod.def.type` for type detection.
 */
export function serialize_params_schema(schema: z.ZodType): ParamDescriptor[] {
	// Access the shape. Zod v4 objects expose .shape on the instance.
	// Unwrap effects (e.g. .strict() returns a ZodObject with same shape).
	const obj = schema as unknown as ZodV4Schema
	const shape = obj.shape ?? obj._zod?.def?.shape

	if (!shape) return []

	const descriptors: ParamDescriptor[] = []
	for (const [key, field] of Object.entries(shape)) {
		const desc = field_to_descriptor(key, field)
		if (desc) descriptors.push(desc)
	}
	return descriptors
}

function unwrap(s: ZodV4Schema): { schema: ZodV4Schema; optional: boolean; default_val: unknown } {
	let schema = s
	let optional = false
	let default_val: unknown = undefined

	// Unwrap optional and default wrappers
	let iteration = 0
	while (iteration++ < 5) {
		const type_name = schema._zod?.def?.type
		if (type_name === "optional") {
			optional = true
			schema = schema._zod!.def.innerType!
		} else if (type_name === "default") {
			default_val = schema._zod!.def.defaultValue
			schema = schema._zod!.def.innerType!
		} else {
			break
		}
	}

	return { schema, optional, default_val }
}

function field_to_descriptor(key: string, raw_schema: ZodV4Schema): ParamDescriptor | null {
	const { schema, optional, default_val } = unwrap(raw_schema)
	const type_name = schema._zod?.def?.type
	const label = key.replace(/_/g, " ")

	switch (type_name) {
		case "string":
			return { key, type: "string", optional, default: default_val, label }

		case "number":
			return { key, type: "number", optional, default: default_val, label }

		case "boolean":
			return { key, type: "boolean", optional, default: default_val, label }

		case "enum": {
			const entries = schema._zod?.def?.entries ?? {}
			const values = Object.values(entries)
			return { key, type: "enum", enum_values: values, optional, default: default_val, label }
		}

		case "array": {
			const element = schema._zod?.def?.element
			const element_type = element?._zod?.def?.type
			if (element_type === "string") {
				return { key, type: "array_string", optional, default: default_val, label }
			}
			return null
		}

		default:
			return null
	}
}
