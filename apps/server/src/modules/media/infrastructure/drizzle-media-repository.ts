import { and, eq, isNull, lte } from "drizzle-orm";
import { type ActorContext, holderOfActor } from "@/modules/identity";
import type { DbClient } from "@/platform/db/client";
import {
	characterPortraits,
	handoutGrantRecipients,
	handoutGrants,
	handouts,
	mediaAssets,
	pendingMediaUploads,
	scenes,
	sessionCharacters,
	sessionClaims,
	sessions,
	tracks,
} from "@/platform/db/schema";
import type {
	MediaAsset,
	MediaRepository,
	PendingMediaUpload,
} from "../application/ports";

export class DrizzleMediaRepository implements MediaRepository {
	constructor(private readonly db: DbClient) {}

	async insert(asset: MediaAsset): Promise<void> {
		await this.db.insert(mediaAssets).values(asset);
	}

	async findById(id: string): Promise<MediaAsset | undefined> {
		const [asset] = await this.db
			.select()
			.from(mediaAssets)
			.where(eq(mediaAssets.id, id))
			.limit(1);
		if (!asset) {
			return undefined;
		}
		return {
			...asset,
			storageProvider: asset.storageProvider === "s3" ? "s3" : "local",
			storageBucket: asset.storageBucket ?? null,
		};
	}

	async insertPendingUpload(record: PendingMediaUpload): Promise<void> {
		await this.db.insert(pendingMediaUploads).values(record);
	}

	async findPendingUploadById(
		id: string,
	): Promise<PendingMediaUpload | undefined> {
		const [row] = await this.db
			.select()
			.from(pendingMediaUploads)
			.where(eq(pendingMediaUploads.id, id))
			.limit(1);
		return row;
	}

	async deletePendingUpload(id: string): Promise<void> {
		await this.db
			.delete(pendingMediaUploads)
			.where(eq(pendingMediaUploads.id, id));
	}

	async listExpiredPendingUploads(
		nowEpochMs: number,
		limit = 100,
	): Promise<PendingMediaUpload[]> {
		return this.db
			.select()
			.from(pendingMediaUploads)
			.where(lte(pendingMediaUploads.expiresAt, nowEpochMs))
			.limit(limit);
	}

	async checkMediaAccess(
		actor: ActorContext,
		assetId: string,
	): Promise<boolean> {
		const db = this.db;
		if (actor.type === "user") {
			const owned = await db
				.select({ id: mediaAssets.id })
				.from(mediaAssets)
				.where(
					and(
						eq(mediaAssets.id, assetId),
						eq(mediaAssets.ownerId, actor.userId),
					),
				)
				.limit(1);
			if (owned.length > 0) {
				return true;
			}

			const sessionOwned = await db
				.select({ id: sessions.id })
				.from(sessions)
				.innerJoin(
					sessionCharacters,
					eq(sessions.id, sessionCharacters.sessionId),
				)
				.innerJoin(
					characterPortraits,
					eq(sessionCharacters.characterId, characterPortraits.characterId),
				)
				.where(
					and(
						eq(sessions.ownerId, actor.userId),
						eq(characterPortraits.portraitAssetId, assetId),
					),
				)
				.limit(1);
			if (sessionOwned.length > 0) {
				return true;
			}
		}

		const holder = holderOfActor(actor);

		const bgAccess = await db
			.select({ id: sessions.id })
			.from(sessions)
			.innerJoin(sessionClaims, eq(sessions.id, sessionClaims.sessionId))
			.innerJoin(scenes, eq(sessions.currentSceneId, scenes.id))
			.where(
				and(
					holder.holderKind === "user"
						? eq(sessionClaims.userId, holder.userId!)
						: eq(sessionClaims.playerId, holder.playerId!),
					isNull(sessionClaims.releasedAt),
					eq(scenes.bgAssetId, assetId),
				),
			)
			.limit(1);

		if (bgAccess.length > 0) {
			return true;
		}

		const trackAccess = await db
			.select({ id: tracks.id })
			.from(tracks)
			.innerJoin(sessions, eq(sessions.moduleId, tracks.moduleId))
			.innerJoin(sessionClaims, eq(sessions.id, sessionClaims.sessionId))
			.where(
				and(
					holder.holderKind === "user"
						? eq(sessionClaims.userId, holder.userId!)
						: eq(sessionClaims.playerId, holder.playerId!),
					isNull(sessionClaims.releasedAt),
					eq(tracks.audioAssetId, assetId),
				),
			)
			.limit(1);

		if (trackAccess.length > 0) {
			return true;
		}

		const portraitAccess = await db
			.select({ id: sessions.id })
			.from(sessions)
			.innerJoin(sessionClaims, eq(sessions.id, sessionClaims.sessionId))
			.innerJoin(
				sessionCharacters,
				eq(sessions.id, sessionCharacters.sessionId),
			)
			.innerJoin(
				characterPortraits,
				eq(sessionCharacters.characterId, characterPortraits.characterId),
			)
			.where(
				and(
					holder.holderKind === "user"
						? eq(sessionClaims.userId, holder.userId!)
						: eq(sessionClaims.playerId, holder.playerId!),
					isNull(sessionClaims.releasedAt),
					eq(characterPortraits.portraitAssetId, assetId),
				),
			)
			.limit(1);

		if (portraitAccess.length > 0) {
			return true;
		}

		// 情报图片：只对「可见该情报发放记录」的玩家可读。
		// 公开情报：玩家在同团有有效 claim；秘密情报：玩家认领的 PC 在可见名单中。
		// 未发放或对其不可见的情报图片一律拒绝（防止秘密情报经可猜 URL 泄漏）。
		const publicHandoutAccess = await db
			.select({ id: handoutGrants.id })
			.from(handoutGrants)
			.innerJoin(handouts, eq(handoutGrants.handoutId, handouts.id))
			.innerJoin(
				sessionClaims,
				and(
					eq(sessionClaims.sessionId, handoutGrants.sessionId),
					holder.holderKind === "user"
						? eq(sessionClaims.userId, holder.userId!)
						: eq(sessionClaims.playerId, holder.playerId!),
					isNull(sessionClaims.releasedAt),
				),
			)
			.where(
				and(eq(handouts.imageAssetId, assetId), eq(handoutGrants.isPublic, 1)),
			)
			.limit(1);

		if (publicHandoutAccess.length > 0) {
			return true;
		}

		const secretHandoutAccess = await db
			.select({ id: handoutGrants.id })
			.from(handoutGrants)
			.innerJoin(handouts, eq(handoutGrants.handoutId, handouts.id))
			.innerJoin(
				handoutGrantRecipients,
				eq(handoutGrantRecipients.grantId, handoutGrants.id),
			)
			.innerJoin(
				sessionClaims,
				and(
					eq(sessionClaims.sessionId, handoutGrants.sessionId),
					holder.holderKind === "user"
						? eq(sessionClaims.userId, holder.userId!)
						: eq(sessionClaims.playerId, holder.playerId!),
					eq(sessionClaims.characterId, handoutGrantRecipients.characterId),
					isNull(sessionClaims.releasedAt),
				),
			)
			.where(
				and(eq(handouts.imageAssetId, assetId), eq(handoutGrants.isPublic, 0)),
			)
			.limit(1);

		if (secretHandoutAccess.length > 0) {
			return true;
		}

		return false;
	}
}
