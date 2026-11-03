import { describe, expect, test } from "bun:test";
import {
	type AdminNavKey,
	adminNavCurrentKey,
} from "../src/features/gm-admin/admin-layout";

const NAV_KEYS: AdminNavKey[] = [
	"sessions",
	"modules",
	"templates",
	"characters",
	"music",
	"blacklist",
	"reviews",
	"trash",
];

describe("GM admin navigation matching", () => {
	test("the session index is only current on the exact /gm route", () => {
		expect(adminNavCurrentKey("/gm")).toBe("sessions");
		expect(adminNavCurrentKey("/gm/")).toBe("sessions");
	});

	test("module detail pages belong to the module item, never to the index item", () => {
		for (const pathname of ["/gm/module/abc-123", "/gm/module/abc-123/"]) {
			expect(adminNavCurrentKey(pathname)).toBe("modules");
		}
		expect(adminNavCurrentKey("/gm/modules")).toBe("modules");
	});

	test("every admin route resolves to exactly one current item", () => {
		const routes: Array<[string, AdminNavKey]> = [
			["/gm", "sessions"],
			["/gm/modules", "modules"],
			["/gm/module/2f4c", "modules"],
			["/gm/characters", "characters"],
			["/gm/music", "music"],
			["/gm/blacklist", "blacklist"],
			["/gm/templates", "templates"],
			["/gm/reviews", "reviews"],
			["/gm/trash", "trash"],
		];
		for (const [pathname, expected] of routes) {
			const current = adminNavCurrentKey(pathname);
			expect(current).toBe(expected);
			expect(NAV_KEYS.filter((key) => key === current)).toHaveLength(1);
		}
		expect(adminNavCurrentKey("/login")).toBeNull();
	});
});
