import { describe, expect, test } from "bun:test";
import { formatStamp } from "../src/lib/format";

describe("formatStamp", () => {
	test("renders a local month-day clock stamp for handout grants", () => {
		expect(formatStamp(new Date(2026, 9, 17, 3, 27).getTime())).toBe(
			"10-17 03:27",
		);
		expect(formatStamp(new Date(2026, 0, 2, 23, 5).getTime())).toBe(
			"01-02 23:05",
		);
	});
});
