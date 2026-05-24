import { afterEach, describe, expect, test } from "bun:test"
import { _reset_runtime_for_tests, runtime_ref, set_runtime } from "./runtime"
import type { Runtime } from "./bootstrap"

afterEach(() => {
	_reset_runtime_for_tests()
})

describe("runtime singleton", () => {
	test("runtime_ref() throws before set_runtime is called", () => {
		expect(() => runtime_ref()).toThrow()
	})

	test("runtime_ref() returns the same instance after set_runtime", () => {
		const fake_runtime = { env: {}, db: {}, sdk: {} } as unknown as Runtime
		set_runtime(fake_runtime)
		expect(runtime_ref()).toBe(fake_runtime)
	})

	test("runtime_ref() returns the same object on multiple calls", () => {
		const fake_runtime = { env: {}, db: {}, sdk: {} } as unknown as Runtime
		set_runtime(fake_runtime)
		expect(runtime_ref()).toBe(runtime_ref())
	})
})
