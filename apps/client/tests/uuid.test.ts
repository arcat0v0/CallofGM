import { afterEach, describe, expect, test } from "bun:test";
import { randomUuid } from "@/lib/uuid";

const UUID_V4_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(
	globalThis,
	"crypto",
);

function setGlobalCrypto(value: unknown): void {
	Object.defineProperty(globalThis, "crypto", {
		value,
		configurable: true,
		writable: true,
	});
}

afterEach(() => {
	if (originalCryptoDescriptor) {
		Object.defineProperty(globalThis, "crypto", originalCryptoDescriptor);
	}
});

describe("randomUuid", () => {
	test("uses crypto.randomUUID when available", () => {
		const expected = "11111111-2222-4333-8444-555555555555";
		setGlobalCrypto({
			randomUUID: () => expected,
			getRandomValues: globalThis.crypto.getRandomValues.bind(
				globalThis.crypto,
			),
		});

		expect(randomUuid()).toBe(expected);
	});

	test("falls back to crypto.getRandomValues when crypto.randomUUID is unavailable", () => {
		let usedGetRandomValues = false;
		const nativeGetRandomValues = globalThis.crypto.getRandomValues.bind(
			globalThis.crypto,
		);
		setGlobalCrypto({
			getRandomValues: <T extends ArrayBufferView>(array: T): T => {
				usedGetRandomValues = true;
				return nativeGetRandomValues(array);
			},
		});

		const id = randomUuid();
		expect(usedGetRandomValues).toBe(true);
		expect(id).toMatch(UUID_V4_PATTERN);
	});

	test("falls back to Math.random when global crypto is unavailable", () => {
		setGlobalCrypto(undefined);

		const id = randomUuid();
		expect(id).toMatch(UUID_V4_PATTERN);
	});
});
