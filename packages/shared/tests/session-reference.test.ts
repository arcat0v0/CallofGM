import { describe, expect, test } from "bun:test";
import {
	extractSessionReference,
	isSixHexSessionReference,
	ResolveSessionReferenceResponse,
} from "../src/session";

describe("session reference helpers", () => {
	test("extracts direct, hash-prefixed, uppercase, whitespace, and URL references", () => {
		expect(extractSessionReference("a1b2c3")).toBe("a1b2c3");
		expect(extractSessionReference("  A1B2C3  ")).toBe("a1b2c3");
		expect(extractSessionReference("#a1b2c3")).toBe("a1b2c3");
		expect(extractSessionReference("  #A1B2C3  ")).toBe("a1b2c3");
		expect(extractSessionReference("/join/a1b2c3")).toBe("a1b2c3");
		expect(
			extractSessionReference("https://cogm.example/join/A1B2C3?from=gm#top"),
		).toBe("a1b2c3");
		expect(extractSessionReference("/join/%23A1B2C3")).toBe("a1b2c3");
		expect(
			extractSessionReference("https://cogm.example/join/%20a1b2c3%20"),
		).toBe("a1b2c3");
	});

	test("preserves full UUIDs and non-short session IDs", () => {
		const uuid = "550e8400-e29b-41d4-a716-446655440000";
		expect(extractSessionReference(uuid)).toBe(uuid);
		expect(
			extractSessionReference(`https://cogm.example/join/${uuid}?foo=bar#hash`),
		).toBe(uuid);
		expect(extractSessionReference("  /join/session-1  ")).toBe("session-1");
	});

	test("returns null safely on empty or malformed percent input", () => {
		expect(extractSessionReference("")).toBeNull();
		expect(extractSessionReference("   ")).toBeNull();
		expect(extractSessionReference("#")).toBeNull();
		expect(extractSessionReference("https://cogm.example/join/")).toBeNull();
		expect(extractSessionReference("/join/%20%20")).toBeNull();
		expect(() => extractSessionReference("%E0%A4%A")).not.toThrow();
		expect(extractSessionReference("%E0%A4%A")).toBeNull();
		expect(() => extractSessionReference("/join/%ZZ")).not.toThrow();
		expect(extractSessionReference("/join/%ZZ")).toBeNull();
		expect(extractSessionReference("a1b2%2")).toBeNull();
	});

	test("validates six-hex references", () => {
		expect(isSixHexSessionReference("a1b2c3")).toBe(true);
		expect(isSixHexSessionReference("012345")).toBe(true);
		expect(isSixHexSessionReference("ABCDEF")).toBe(true);
		expect(isSixHexSessionReference("a1b2c")).toBe(false);
		expect(isSixHexSessionReference("a1b2c34")).toBe(false);
		expect(isSixHexSessionReference("a1b2cg")).toBe(false);
		expect(isSixHexSessionReference("#a1b2c3")).toBe(false);
		expect(isSixHexSessionReference(" a1b2c3 ")).toBe(false);
		expect(
			isSixHexSessionReference("550e8400-e29b-41d4-a716-446655440000"),
		).toBe(false);
	});

	test("parses session reference response schema", () => {
		const parsed = ResolveSessionReferenceResponse.parse({
			sessionId: "550e8400-e29b-41d4-a716-446655440000",
		});
		expect(parsed.sessionId).toBe("550e8400-e29b-41d4-a716-446655440000");
		expect(() => ResolveSessionReferenceResponse.parse({})).toThrow();
	});
});
