import { Elysia, t } from "elysia";
import { eq, and, isNull } from "drizzle-orm";
import { type Container } from "@/bootstrap/container";
import { type DbClient } from "@/platform/db/client";
import {
  mediaAssets,
  sessions,
  sessionClaims,
  scenes,
  sessionAudioState,
  tracks,
  sessionCharacters,
  characterPortraits,
  handouts,
  handoutGrants,
  handoutGrantRecipients
} from "@/platform/db/schema";
import { LocalMediaStorage } from "../infrastructure/local-media-storage";
import { UploadMediaUseCase } from "../application/upload-media";
import {
  MediaAssetNotFoundError,
  UnauthorizedMediaAccessError
} from "../domain/media-errors";
import { createAuthPlugin } from "@/modules/identity";
import { DrizzleIdentityRepository } from "@/modules/identity";
import { AuthRequiredError } from "@/modules/identity";
import { ForbiddenError } from "@/modules/identity";
import { type ActorContext } from "@/modules/identity";

async function checkMediaAccess(
  db: DbClient,
  actor: ActorContext,
  assetId: string
): Promise<boolean> {
  if (actor.type === "gm") {
    return true;
  }

  const playerId = actor.playerId;

  const bgAccess = await db
    .select({ id: sessions.id })
    .from(sessions)
    .innerJoin(sessionClaims, eq(sessions.id, sessionClaims.sessionId))
    .innerJoin(scenes, eq(sessions.currentSceneId, scenes.id))
    .where(
      and(
        eq(sessionClaims.playerId, playerId),
        isNull(sessionClaims.releasedAt),
        eq(scenes.bgAssetId, assetId)
      )
    )
    .limit(1);

  if (bgAccess.length > 0) {
    return true;
  }

  const trackAccess = await db
    .select({ id: sessions.id })
    .from(sessions)
    .innerJoin(sessionClaims, eq(sessions.id, sessionClaims.sessionId))
    .innerJoin(sessionAudioState, eq(sessions.id, sessionAudioState.sessionId))
    .innerJoin(tracks, eq(sessionAudioState.trackId, tracks.id))
    .where(
      and(
        eq(sessionClaims.playerId, playerId),
        isNull(sessionClaims.releasedAt),
        eq(sessionAudioState.playing, 1),
        eq(tracks.audioAssetId, assetId)
      )
    )
    .limit(1);

  if (trackAccess.length > 0) {
    return true;
  }

  const portraitAccess = await db
    .select({ id: sessions.id })
    .from(sessions)
    .innerJoin(sessionClaims, eq(sessions.id, sessionClaims.sessionId))
    .innerJoin(sessionCharacters, eq(sessions.id, sessionCharacters.sessionId))
    .innerJoin(
      characterPortraits,
      eq(sessionCharacters.characterId, characterPortraits.characterId)
    )
    .where(
      and(
        eq(sessionClaims.playerId, playerId),
        isNull(sessionClaims.releasedAt),
        eq(characterPortraits.portraitAssetId, assetId)
      )
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
        eq(sessionClaims.playerId, playerId),
        isNull(sessionClaims.releasedAt)
      )
    )
    .where(and(eq(handouts.imageAssetId, assetId), eq(handoutGrants.isPublic, 1)))
    .limit(1);

  if (publicHandoutAccess.length > 0) {
    return true;
  }

  const secretHandoutAccess = await db
    .select({ id: handoutGrants.id })
    .from(handoutGrants)
    .innerJoin(handouts, eq(handoutGrants.handoutId, handouts.id))
    .innerJoin(handoutGrantRecipients, eq(handoutGrantRecipients.grantId, handoutGrants.id))
    .innerJoin(
      sessionClaims,
      and(
        eq(sessionClaims.sessionId, handoutGrants.sessionId),
        eq(sessionClaims.playerId, playerId),
        eq(sessionClaims.characterId, handoutGrantRecipients.characterId),
        isNull(sessionClaims.releasedAt)
      )
    )
    .where(and(eq(handouts.imageAssetId, assetId), eq(handoutGrants.isPublic, 0)))
    .limit(1);

  if (secretHandoutAccess.length > 0) {
    return true;
  }

  return false;
}

export function createMediaRoutes(container: Container) {
  const mediaStorage = new LocalMediaStorage(container.env.MEDIA_DIR);
  const uploadUseCase = new UploadMediaUseCase(
    container.db,
    mediaStorage,
    container.idGenerator,
    container.clock
  );

  const identityRepo = new DrizzleIdentityRepository(container.db);
  const tokenSigner = container.playerTokenSigner;
  const authPlugin = createAuthPlugin(identityRepo, tokenSigner);

  return new Elysia()
    .use(authPlugin)
    .post(
      "/api/v1/media/upload",
      async ({ body, actor }) => {
        if (!actor) {
          throw new AuthRequiredError();
        }
        if (actor.type !== "gm") {
          throw new ForbiddenError("Only the GM can upload media");
        }
        const file = body.file as Blob;
        const purpose = body.purpose || "general";
        const filename = body.filename || "file";

        const asset = await uploadUseCase.execute({
          blob: file,
          filename,
          purpose
        });

        return asset;
      },
      {
        body: t.Object({
          file: t.File(),
          purpose: t.Optional(t.String()),
          filename: t.Optional(t.String())
        })
      }
    )
    .get("/api/v1/media/:id", async ({ params, actor }) => {
      if (!actor) {
        throw new AuthRequiredError();
      }

      const [asset] = await container.db
        .select()
        .from(mediaAssets)
        .where(eq(mediaAssets.id, params.id))
        .limit(1);

      if (!asset) {
        throw new MediaAssetNotFoundError();
      }

      const hasAccess = await checkMediaAccess(container.db, actor, asset.id);
      if (!hasAccess) {
        throw new UnauthorizedMediaAccessError();
      }

      const fileData = await mediaStorage.read(asset.storageKey);

      return new Response(fileData, {
        headers: {
          "Content-Type": asset.mimeType,
          "Content-Length": asset.size.toString()
        }
      });
    });
}
