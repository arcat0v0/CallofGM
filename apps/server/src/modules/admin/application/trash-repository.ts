import type { TrashEntityType, TrashItemDto } from "@cogm/shared";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
	handouts,
	mediaAssets,
	modules,
	scenes,
	tracks,
} from "@/platform/db/schema/catalog";
import {
	characterPortraits,
	characters,
} from "@/platform/db/schema/characters";
import { users } from "@/platform/db/schema/identity";
import { sessions } from "@/platform/db/schema/sessions";
import { templates } from "@/platform/db/schema/templates";
import { AppError } from "@/platform/errors/app-error";

export class TrashItemNotFoundError extends AppError {
	constructor() {
		super("TRASH_ITEM_NOT_FOUND", "Trashed resource not found", 404);
	}
}

/** 回收站：按所有权隔离；admin 只看到账号，不做跨所有者级联恢复 */
export class TrashRepository {
	constructor(private readonly db: DbClient) {}

	private collect(
		items: TrashItemDto[],
		entityType: TrashEntityType,
		rows: Array<Record<string, unknown>>,
		nameColumn: string,
	): void {
		for (const row of rows) {
			items.push({
				entityType,
				id: String(row.id),
				name: String(row[nameColumn] ?? ""),
				deletedAt: Number(row.deletedAt ?? 0),
			});
		}
	}

	private ownedModuleIds(userId: string) {
		return this.db
			.select({ id: modules.id })
			.from(modules)
			.where(eq(modules.ownerId, userId));
	}

	private async scenesOfOwnedModules(userId: string) {
		return this.db
			.select()
			.from(scenes)
			.where(
				and(
					inArray(scenes.moduleId, this.ownedModuleIds(userId)),
					isNotNull(scenes.deletedAt),
				),
			)
			.limit(200);
	}

	private async tracksOfOwnedModules(userId: string) {
		return this.db
			.select()
			.from(tracks)
			.where(
				and(
					inArray(tracks.moduleId, this.ownedModuleIds(userId)),
					isNotNull(tracks.deletedAt),
				),
			)
			.limit(200);
	}

	private async handoutsOfOwnedModules(userId: string) {
		return this.db
			.select()
			.from(handouts)
			.where(
				and(
					inArray(handouts.moduleId, this.ownedModuleIds(userId)),
					isNotNull(handouts.deletedAt),
				),
			)
			.limit(200);
	}

	private async owningModuleIdOfScene(
		sceneId: string,
		userId: string,
	): Promise<string | null> {
		const rows = await this.db
			.select({ moduleId: scenes.moduleId })
			.from(scenes)
			.innerJoin(modules, eq(scenes.moduleId, modules.id))
			.where(and(eq(scenes.id, sceneId), eq(modules.ownerId, userId)))
			.limit(1);
		return rows[0]?.moduleId ?? null;
	}

	private async owningModuleIdOfTrack(
		trackId: string,
		userId: string,
	): Promise<string | null> {
		const rows = await this.db
			.select({ moduleId: tracks.moduleId })
			.from(tracks)
			.innerJoin(modules, eq(tracks.moduleId, modules.id))
			.where(and(eq(tracks.id, trackId), eq(modules.ownerId, userId)))
			.limit(1);
		return rows[0]?.moduleId ?? null;
	}

	private async owningModuleIdOfHandout(
		handoutId: string,
		userId: string,
	): Promise<string | null> {
		const rows = await this.db
			.select({ moduleId: handouts.moduleId })
			.from(handouts)
			.innerJoin(modules, eq(handouts.moduleId, modules.id))
			.where(and(eq(handouts.id, handoutId), eq(modules.ownerId, userId)))
			.limit(1);
		return rows[0]?.moduleId ?? null;
	}

	async listOwned(userId: string): Promise<TrashItemDto[]> {
		const items: TrashItemDto[] = [];

		this.collect(
			items,
			"module",
			(await this.db
				.select()
				.from(modules)
				.where(and(eq(modules.ownerId, userId), isNotNull(modules.deletedAt)))
				.limit(200)) as Array<Record<string, unknown>>,
			"name",
		);
		this.collect(
			items,
			"scene",
			(await this.scenesOfOwnedModules(userId)) as Array<
				Record<string, unknown>
			>,
			"name",
		);
		this.collect(
			items,
			"track",
			(await this.tracksOfOwnedModules(userId)) as Array<
				Record<string, unknown>
			>,
			"name",
		);
		this.collect(
			items,
			"handout",
			(await this.handoutsOfOwnedModules(userId)) as Array<
				Record<string, unknown>
			>,
			"title",
		);
		this.collect(
			items,
			"character",
			(await this.db
				.select()
				.from(characters)
				.where(
					and(eq(characters.ownerId, userId), isNotNull(characters.deletedAt)),
				)
				.limit(200)) as Array<Record<string, unknown>>,
			"name",
		);
		this.collect(
			items,
			"session",
			(await this.db
				.select()
				.from(sessions)
				.where(and(eq(sessions.ownerId, userId), isNotNull(sessions.deletedAt)))
				.limit(200)) as Array<Record<string, unknown>>,
			"name",
		);
		this.collect(
			items,
			"template",
			(await this.db
				.select()
				.from(templates)
				.where(
					and(eq(templates.ownerId, userId), isNotNull(templates.deletedAt)),
				)
				.limit(200)) as Array<Record<string, unknown>>,
			"name",
		);
		this.collect(
			items,
			"media",
			(await this.db
				.select()
				.from(mediaAssets)
				.where(
					and(
						eq(mediaAssets.ownerId, userId),
						isNotNull(mediaAssets.deletedAt),
					),
				)
				.limit(200)) as Array<Record<string, unknown>>,
			"filename",
		);

		const ownedCharacterIds = new Set(
			(
				await this.db
					.select({ id: characters.id })
					.from(characters)
					.where(eq(characters.ownerId, userId))
			).map((row) => row.id),
		);
		const portraitRows = await this.db
			.select({
				id: characterPortraits.id,
				characterId: characterPortraits.characterId,
				deletedAt: characterPortraits.deletedAt,
			})
			.from(characterPortraits)
			.where(isNotNull(characterPortraits.deletedAt))
			.limit(200);
		for (const row of portraitRows) {
			if (!ownedCharacterIds.has(row.characterId)) continue;
			items.push({
				entityType: "character",
				id: row.id,
				name: `portrait:${row.characterId}`,
				deletedAt: Number(row.deletedAt ?? 0),
			});
		}

		return items.sort((a, b) => b.deletedAt - a.deletedAt);
	}

	async listAdmin(): Promise<TrashItemDto[]> {
		const rows = await this.db
			.select()
			.from(users)
			.where(isNotNull(users.deletedAt));
		return rows.map((row) => ({
			entityType: "user" as const,
			id: row.id,
			name: row.username,
			deletedAt: Number(row.deletedAt ?? 0),
		}));
	}

	async restoreOwned(
		userId: string,
		entityType: TrashEntityType,
		id: string,
	): Promise<boolean> {
		const owned = <T extends { id: unknown; ownerId: unknown }>(table: T) =>
			and(eq(table.id as never, id), eq(table.ownerId as never, userId));

		switch (entityType) {
			case "module":
				return (
					(
						await this.db
							.update(modules)
							.set({ deletedAt: null })
							.where(owned(modules))
							.returning({ id: modules.id })
					).length > 0
				);
			case "scene": {
				const moduleId = await this.owningModuleIdOfScene(id, userId);
				if (!moduleId) return false;
				return (
					(
						await this.db
							.update(scenes)
							.set({ deletedAt: null })
							.where(eq(scenes.id, id))
							.returning({ id: scenes.id })
					).length > 0
				);
			}
			case "track": {
				const moduleId = await this.owningModuleIdOfTrack(id, userId);
				if (!moduleId) return false;
				return (
					(
						await this.db
							.update(tracks)
							.set({ deletedAt: null })
							.where(eq(tracks.id, id))
							.returning({ id: tracks.id })
					).length > 0
				);
			}
			case "handout": {
				const moduleId = await this.owningModuleIdOfHandout(id, userId);
				if (!moduleId) return false;
				return (
					(
						await this.db
							.update(handouts)
							.set({ deletedAt: null })
							.where(eq(handouts.id, id))
							.returning({ id: handouts.id })
					).length > 0
				);
			}
			case "character": {
				const restored = await this.db
					.update(characters)
					.set({ deletedAt: null })
					.where(owned(characters))
					.returning({ id: characters.id });
				if (restored.length > 0) {
					return true;
				}
				const portraits = await this.db
					.update(characterPortraits)
					.set({ deletedAt: null })
					.where(eq(characterPortraits.id, id))
					.returning({ id: characterPortraits.id });
				return portraits.length > 0;
			}
			case "session":
				return (
					(
						await this.db
							.update(sessions)
							.set({ deletedAt: null })
							.where(owned(sessions))
							.returning({ id: sessions.id })
					).length > 0
				);
			case "template":
				return (
					(
						await this.db
							.update(templates)
							.set({ deletedAt: null })
							.where(owned(templates))
							.returning({ id: templates.id })
					).length > 0
				);
			case "media":
				return (
					(
						await this.db
							.update(mediaAssets)
							.set({ deletedAt: null })
							.where(owned(mediaAssets))
							.returning({ id: mediaAssets.id })
					).length > 0
				);
			default:
				return false;
		}
	}

	async restoreOwnedUser(id: string): Promise<boolean> {
		const updated = await this.db
			.update(users)
			.set({ deletedAt: null })
			.where(eq(users.id, id))
			.returning({ id: users.id });
		return updated.length > 0;
	}

	async findParentState(
		entityType: TrashEntityType,
		id: string,
	): Promise<{ parentDeleted: boolean }> {
		if (
			entityType === "scene" ||
			entityType === "track" ||
			entityType === "handout"
		) {
			const table =
				entityType === "scene"
					? scenes
					: entityType === "track"
						? tracks
						: handouts;
			const rows = await this.db
				.select()
				.from(table)
				.where(eq(table.id, id))
				.limit(1);
			const moduleId = rows[0]?.moduleId;
			if (!moduleId) return { parentDeleted: false };
			const parents = await this.db
				.select({ deletedAt: modules.deletedAt })
				.from(modules)
				.where(eq(modules.id, moduleId))
				.limit(1);
			return { parentDeleted: parents[0]?.deletedAt != null };
		}
		if (entityType === "session") {
			const rows = await this.db
				.select({ moduleId: sessions.moduleId })
				.from(sessions)
				.where(eq(sessions.id, id))
				.limit(1);
			const moduleId = rows[0]?.moduleId;
			if (!moduleId) return { parentDeleted: false };
			const parents = await this.db
				.select({ deletedAt: modules.deletedAt })
				.from(modules)
				.where(eq(modules.id, moduleId))
				.limit(1);
			return { parentDeleted: parents[0]?.deletedAt != null };
		}
		return { parentDeleted: false };
	}
}
