import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { DrizzleTrashRepository } from "@/modules/admin/infrastructure/drizzle-trash-repository";
import { createDb } from "@/platform/db/client";
import { runMigrations } from "@/platform/db/migration";
import { mediaAssets } from "@/platform/db/schema/catalog";
import {
	characterPortraits,
	characters,
} from "@/platform/db/schema/characters";
import { users } from "@/platform/db/schema/identity";

async function withPortraitFixture(
	testFixture: (repo: DrizzleTrashRepository) => Promise<void>,
	characterDeletedAt: number | null = null,
) {
	const { db, sqlite } = createDb(":memory:");
	try {
		await runMigrations(db);
		await db.insert(users).values(
			["owner", "other-owner"].map((id) => ({
				id,
				username: id,
				usernameNormalized: id,
				passwordHash: "unused",
				role: "gm",
				createdAt: 1,
				updatedAt: 1,
			})),
		);
		await db.insert(characters).values({
			id: "character",
			ownerId: "owner",
			ownerKind: "gm",
			name: "Character",
			kind: "npc",
			ruleId: "coc7e",
			sheetJson: "{}",
			deletedAt: characterDeletedAt,
			createdAt: 1,
			updatedAt: 1,
		});
		await db.insert(mediaAssets).values({
			id: "asset",
			ownerId: "owner",
			purpose: "portrait",
			storageKey: "portrait.png",
			filename: "portrait.png",
			mimeType: "image/png",
			size: 1,
			sha256: "fixture-hash",
			createdAt: 1,
		});
		await db.insert(characterPortraits).values({
			id: "portrait",
			characterId: "character",
			expressionKey: "default",
			portraitAssetId: "asset",
			isDefault: 1,
			deletedAt: 2,
			createdAt: 1,
		});
		await testFixture(new DrizzleTrashRepository(db));
		return await db
			.select({ deletedAt: characterPortraits.deletedAt })
			.from(characterPortraits)
			.where(eq(characterPortraits.id, "portrait"))
			.get();
	} finally {
		sqlite.close();
	}
}

describe("Trash repository portrait scope", () => {
	test("lists a trashed portrait only for the owner and restores it for that owner", async () => {
		const portrait = await withPortraitFixture(async (repo) => {
			const [item] = await repo.listOwned("owner");
			expect(item).toEqual({
				id: "portrait",
				entityType: "character",
				name: "portrait:character",
				deletedAt: 2,
			});
			expect(await repo.listOwned("other-owner")).toEqual([]);
			if (!item) throw new Error("Expected a trashed portrait");
			expect(
				await repo.restoreOwned("other-owner", item.entityType, item.id),
			).toBe(false);
			expect(await repo.listOwned("owner")).toEqual([item]);
			expect(await repo.restoreOwned("owner", item.entityType, item.id)).toBe(
				true,
			);
			expect(await repo.listOwned("owner")).toEqual([]);
		});
		expect(portrait).toEqual({ deletedAt: null });
	});

	test("requires the owner to restore the character before its portrait", async () => {
		const portrait = await withPortraitFixture(async (repo) => {
			expect((await repo.listOwned("owner")).map((item) => item.id)).toEqual([
				"character",
			]);
			expect(await repo.restoreOwned("owner", "character", "portrait")).toBe(
				false,
			);
			expect(await repo.restoreOwned("owner", "character", "character")).toBe(
				true,
			);
			expect((await repo.listOwned("owner")).map((item) => item.id)).toEqual([
				"portrait",
			]);
		}, 3);
		expect(portrait).toEqual({ deletedAt: 2 });
	});
});
