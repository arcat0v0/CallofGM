import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import type { ThemeManifest } from "@cogm/shared";
import { zipSync } from "fflate";
import { setupTestApp, type TestContext } from "../helpers/setup";

function sha256(data: Uint8Array): string {
	return createHash("sha256").update(data).digest("hex");
}

function buildArchive(
	input: {
		id?: string;
		version?: string;
		apiVersion?: number;
		bundle?: string;
		bundleHash?: string;
		extraFiles?: Record<string, Uint8Array>;
	} = {},
): { archive: Uint8Array; manifest: ThemeManifest } {
	const id = input.id ?? "arcat.test";
	const version = input.version ?? "1.0.0";
	const bundle = new TextEncoder().encode(
		input.bundle ?? "export default { slots: {} };",
	);
	const manifest: ThemeManifest = {
		formatVersion: 1,
		id,
		name: "Test Theme",
		version,
		apiVersion: input.apiVersion ?? 1,
		description: "test",
		author: "tester",
		entry: "bundle.js",
		styles: [],
		defaultLocale: "zh-CN",
		locales: [],
		bundleHash: input.bundleHash ?? `sha256:${sha256(bundle)}`,
		signature: null,
	};
	const files: Record<string, Uint8Array> = {
		"theme.json": new TextEncoder().encode(JSON.stringify(manifest)),
		"bundle.js": bundle,
		...input.extraFiles,
	};
	return { archive: zipSync(files), manifest };
}

describe("Theme registry and API contract tests", () => {
	let ctx: TestContext;

	function authHeaders(): Record<string, string> {
		return { Authorization: `Bearer ${ctx.gmToken}` };
	}

	async function upload(archive: Uint8Array): Promise<Response> {
		const form = new FormData();
		form.set(
			"file",
			new File([archive], "theme.cogmtheme", { type: "application/zip" }),
		);
		return ctx.app.handle(
			new Request("http://localhost/api/v1/gm/themes", {
				method: "POST",
				headers: authHeaders(),
				body: form,
			}),
		);
	}

	beforeAll(async () => {
		ctx = await setupTestApp({ gmPassword: "theme-test-password" });
	});

	afterAll(async () => {
		await rm(ctx.themesDir, { recursive: true, force: true });
	});

	test("GM theme routes require authentication", async () => {
		const res = await ctx.app.handle(
			new Request("http://localhost/api/v1/gm/themes"),
		);
		expect(res.status).toBe(401);
	});

	test("installs a valid theme and serves manifest and bundle", async () => {
		const { archive, manifest } = buildArchive();
		const res = await upload(archive);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { id: string; version: string };
		expect(body.id).toBe(manifest.id);
		expect(body.version).toBe(manifest.version);

		const listRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/gm/themes", {
				headers: authHeaders(),
			}),
		);
		expect(listRes.status).toBe(200);
		const list = (await listRes.json()) as {
			items: Array<{ id: string; digest: string }>;
		};
		expect(list.items[0]?.id).toBe(manifest.id);
		expect(list.items[0]?.digest).toBe(manifest.bundleHash);

		const rescanRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/gm/themes/rescan", {
				method: "POST",
				headers: authHeaders(),
			}),
		);
		expect(rescanRes.status).toBe(200);
		const rescanned = (await rescanRes.json()) as {
			items: Array<{ id: string; digest: string }>;
		};
		expect(rescanned.items[0]?.id).toBe(manifest.id);
		expect(rescanned.items[0]?.digest).toBe(manifest.bundleHash);

		const manifestRes = await ctx.app.handle(
			new Request(`http://localhost/api/v1/themes/${manifest.id}/manifest`),
		);
		expect(manifestRes.status).toBe(200);
		expect(manifestRes.headers.get("cache-control")).toBe("no-cache");
		expect(((await manifestRes.json()) as ThemeManifest).version).toBe(
			manifest.version,
		);

		const bundleRes = await ctx.app.handle(
			new Request(
				`http://localhost/api/v1/themes/${manifest.id}/versions/${manifest.version}/bundle.js`,
			),
		);
		expect(bundleRes.status).toBe(200);
		expect(bundleRes.headers.get("content-type")).toContain("text/javascript");
		expect(bundleRes.headers.get("cache-control")).toContain("immutable");
		expect(await bundleRes.text()).toContain("export default");
	});

	test("rejects incompatible API versions", async () => {
		const { archive } = buildArchive({ id: "arcat.api2", apiVersion: 2 });
		const res = await upload(archive);
		expect(res.status).toBe(409);
		expect(((await res.json()) as { code: string }).code).toBe(
			"THEME_INCOMPATIBLE",
		);
	});

	test("rejects a mismatched bundle hash", async () => {
		const { archive } = buildArchive({
			id: "arcat.badhash",
			bundleHash: `sha256:${"0".repeat(64)}`,
		});
		const res = await upload(archive);
		expect(res.status).toBe(400);
		expect(((await res.json()) as { code: string }).code).toBe("THEME_INVALID");
	});

	test("rejects path traversal and unknown files", async () => {
		const traversal = buildArchive({
			id: "arcat.traversal",
			extraFiles: { "../evil.js": new TextEncoder().encode("x") },
		});
		const traversalRes = await upload(traversal.archive);
		expect(traversalRes.status).toBe(400);

		const unknown = buildArchive({
			id: "arcat.unknown",
			extraFiles: { "source.tsx": new TextEncoder().encode("x") },
		});
		const unknownRes = await upload(unknown.archive);
		expect(unknownRes.status).toBe(400);
	});

	test("rejects same-or-lower versions and accepts a newer version", async () => {
		const first = buildArchive({ id: "arcat.version", version: "1.0.0" });
		expect((await upload(first.archive)).status).toBe(200);

		const same = buildArchive({ id: "arcat.version", version: "1.0.0" });
		expect((await upload(same.archive)).status).toBe(409);

		const newer = buildArchive({
			id: "arcat.version",
			version: "1.1.0",
			bundle: "export default { slots: {} }; // v2",
		});
		expect((await upload(newer.archive)).status).toBe(200);
	});

	test("blocks deletion while a module references the theme, then allows it", async () => {
		const { archive, manifest } = buildArchive({ id: "arcat.inuse" });
		expect((await upload(archive)).status).toBe(200);

		const patchRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/gm/modules/module-test", {
				method: "PATCH",
				headers: { ...authHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ themeId: manifest.id }),
			}),
		);
		expect(patchRes.status).toBe(200);
		expect(((await patchRes.json()) as { themeId: string }).themeId).toBe(
			manifest.id,
		);

		const blocked = await ctx.app.handle(
			new Request(`http://localhost/api/v1/gm/themes/${manifest.id}`, {
				method: "DELETE",
				headers: authHeaders(),
			}),
		);
		expect(blocked.status).toBe(409);
		expect(
			(
				(await blocked.json()) as {
					code: string;
					metadata: { usedByModules: number };
				}
			).metadata.usedByModules,
		).toBe(1);

		const resetRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/gm/modules/module-test", {
				method: "PATCH",
				headers: { ...authHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ themeId: null }),
			}),
		);
		expect(resetRes.status).toBe(200);

		const deleted = await ctx.app.handle(
			new Request(`http://localhost/api/v1/gm/themes/${manifest.id}`, {
				method: "DELETE",
				headers: authHeaders(),
			}),
		);
		expect(deleted.status).toBe(200);
	});

	test("persists GM UI theme settings and validates the theme id", async () => {
		const { archive, manifest } = buildArchive({ id: "arcat.gm-ui" });
		expect((await upload(archive)).status).toBe(200);

		const invalid = await ctx.app.handle(
			new Request("http://localhost/api/v1/gm/ui-settings", {
				method: "PUT",
				headers: { ...authHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ gmThemeId: "arcat.missing" }),
			}),
		);
		expect(invalid.status).toBe(404);

		const put = await ctx.app.handle(
			new Request("http://localhost/api/v1/gm/ui-settings", {
				method: "PUT",
				headers: { ...authHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ gmThemeId: manifest.id }),
			}),
		);
		expect(put.status).toBe(200);

		const get = await ctx.app.handle(
			new Request("http://localhost/api/v1/gm/ui-settings", {
				headers: authHeaders(),
			}),
		);
		expect(((await get.json()) as { gmThemeId: string }).gmThemeId).toBe(
			manifest.id,
		);

		const blocked = await ctx.app.handle(
			new Request(`http://localhost/api/v1/gm/themes/${manifest.id}`, {
				method: "DELETE",
				headers: authHeaders(),
			}),
		);
		expect(blocked.status).toBe(409);
	});

	test("resolves the module theme on join info and public session theme route", async () => {
		const { archive, manifest } = buildArchive({ id: "arcat.session" });
		expect((await upload(archive)).status).toBe(200);
		await ctx.app.handle(
			new Request("http://localhost/api/v1/gm/modules/module-test", {
				method: "PATCH",
				headers: { ...authHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ themeId: manifest.id }),
			}),
		);

		const join = await ctx.app.handle(
			new Request(
				`http://localhost/api/v1/public/sessions/${ctx.sessionId}/join-info`,
			),
		);
		expect(join.status).toBe(200);
		expect(
			((await join.json()) as { session: { themeId: string } }).session.themeId,
		).toBe(manifest.id);

		const theme = await ctx.app.handle(
			new Request(
				`http://localhost/api/v1/public/sessions/${ctx.sessionId}/theme`,
			),
		);
		expect(theme.status).toBe(200);
		expect(((await theme.json()) as { themeId: string }).themeId).toBe(
			manifest.id,
		);

		await ctx.app.handle(
			new Request("http://localhost/api/v1/gm/modules/module-test", {
				method: "PATCH",
				headers: { ...authHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ themeId: null }),
			}),
		);
	});

	test("returns 404 for unknown themes and files", async () => {
		const manifestRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/themes/arcat.missing/manifest"),
		);
		expect(manifestRes.status).toBe(404);

		const fileRes = await ctx.app.handle(
			new Request(
				"http://localhost/api/v1/themes/arcat.missing/versions/1.0.0/bundle.js",
			),
		);
		expect(fileRes.status).toBe(404);
	});
});
