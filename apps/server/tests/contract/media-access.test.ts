import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { CharacterPortraitDto, MediaAssetDto } from "@cogm/shared";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { characters } from "@/platform/db/schema";
import {
	listenTestApp,
	setupTestApp,
	type TestContext,
	type TestServer,
} from "../helpers/setup";

describe("Media access four-tier contract tests", () => {
	let ctx: TestContext;
	let server: TestServer;
	let mediaDir = "";

	const PNG_1X1 = Uint8Array.from([
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
	]);

	async function uploadMedia(token: string): Promise<string> {
		const formData = new FormData();
		formData.append("file", new Blob([PNG_1X1], { type: "image/png" }), "p.png");
		formData.append("purpose", "portrait");
		const res = await ctx.app.handle(
			new Request("http://localhost/api/v1/media/upload", {
				method: "POST",
				body: formData,
				headers: { Authorization: `Bearer ${token}` },
			}),
		);
		expect(res.status).toBe(200);
		return MediaAssetDto.parse(await res.json()).id;
	}

	function getMedia(token: string, assetId: string): Promise<Response> {
		return ctx.app.handle(
			new Request(`http://localhost/api/v1/media/${assetId}`, {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);
	}

	beforeAll(async () => {
		mediaDir = await mkdtemp(join(tmpdir(), "cogm-media-access-"));
		process.env.MEDIA_DIR = mediaDir;
		ctx = await setupTestApp({
			players: ["anon1"],
			claims: [{ player: "anon1", role: "ob" }],
			plAccounts: ["plowner", "plother"],
			characters: [
				{
					id: "char-media",
					name: "媒体测试",
					kind: "pc",
					portraits: ["default"],
				},
			],
		});
		server = listenTestApp(ctx.app);

		const plownerId = ctx.plIds.get("plowner");
		if (!plownerId) {
			throw new Error("plowner account missing");
		}
		await ctx.container.db
			.update(characters)
			.set({ ownerId: plownerId, ownerKind: "pl" })
			.where(eq(characters.id, "char-media"));
	});

	afterAll(async () => {
		await server.stop(true);
		ctx.container.dbContext.sqlite.close();
		if (mediaDir) {
			await rm(mediaDir, { recursive: true, force: true });
		}
	});

	test("PL owner uploads portrait, asset flows to session for all four tiers", async () => {
		const assetPl = await uploadMedia(ctx.plTokens.get("plowner")!);
		const addRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/pl/characters/char-media/portraits", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${ctx.plTokens.get("plowner")!}`,
				},
				body: JSON.stringify({ label: "新表情", portraitAssetId: assetPl }),
			}),
		);
		expect(addRes.status).toBe(200);
		const portrait = CharacterPortraitDto.parse(await addRes.json());
		expect(portrait.expressionKey).toMatch(/^expr_[0-9a-f]{10}$/);

		const ownerRes = await getMedia(ctx.plTokens.get("plowner")!, assetPl);
		expect(ownerRes.status).toBe(200);

		const otherRes = await getMedia(ctx.plTokens.get("plother")!, assetPl);
		expect(otherRes.status).toBe(403);

		const gmRes = await getMedia(ctx.gmToken, assetPl);
		expect(gmRes.status).toBe(200);

		const anonRes = await getMedia(ctx.playerTokens.get("anon1")!, assetPl);
		expect(anonRes.status).toBe(200);
	});

	test("GM-owned asset readable by GM as owner, rejected for unrelated PL", async () => {
		const assetGm = await uploadMedia(ctx.gmToken);
		const otherRes = await getMedia(ctx.plTokens.get("plother")!, assetGm);
		expect(otherRes.status).toBe(403);
		const gmRes = await getMedia(ctx.gmToken, assetGm);
		expect(gmRes.status).toBe(200);
	});
});
