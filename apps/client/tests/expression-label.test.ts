import { describe, expect, test } from "bun:test";
import { expressionLabel } from "../src/lib/format";

describe("expressionLabel", () => {
	test("prefers the portrait label over the key", () => {
		expect(expressionLabel("toast_glass", "举杯")).toBe("举杯");
	});

	test("falls back to the built-in i18n translation", () => {
		expect(expressionLabel("smile")).toBe("微笑");
	});

	test("falls back to the raw key for unknown custom keys", () => {
		expect(expressionLabel("toast_glass")).toBe("toast_glass");
	});

	test("uses the default label for an empty key", () => {
		expect(expressionLabel(null)).toBe("默认");
	});
});
