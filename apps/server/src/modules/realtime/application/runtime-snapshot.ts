import { eq, inArray } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
  sessions,
  sessionCharacters,
  checkRequests,
  handoutGrants,
  handoutGrantRecipients,
  handoutReads,
} from "@/platform/db/schema";

export interface RuntimeSnapshotCharacter {
  characterId: string;
  kind: string;
  currentExpressionKey: string | null;
  stateJson: string;
}

export interface RuntimeSnapshotCheckRequest {
  id: string;
  characterId: string;
  skillKey: string;
  difficulty: string;
  bonusDice: number;
  penaltyDice: number;
  hidden: number;
  sanLossExpression: string | null;
  status: string;
  resolvedCheckResultJson: string | null;
  createdAt: number;
}

export interface RuntimeSnapshotHandoutRead {
  playerId: string | null;
  userId: string | null;
  readAt: number;
}

export interface RuntimeSnapshotHandoutGrant {
  id: string;
  handoutId: string;
  isPublic: number;
  createdAt: number;
  recipients: string[];
  reads: RuntimeSnapshotHandoutRead[];
}

export interface RuntimeSnapshot {
  phase: string;
  currentSceneId: string | null;
  characters: RuntimeSnapshotCharacter[];
  checkRequests: RuntimeSnapshotCheckRequest[];
  handoutGrants: RuntimeSnapshotHandoutGrant[];
}

export function initialRuntimeSnapshot(input: {
  phase: string;
  currentSceneId: string | null;
  characters: RuntimeSnapshotCharacter[];
}): RuntimeSnapshot {
  return {
    phase: input.phase,
    currentSceneId: input.currentSceneId,
    characters: input.characters,
    checkRequests: [],
    handoutGrants: [],
  };
}

export async function captureRuntimeSnapshot(db: DbClient, sessionId: string): Promise<RuntimeSnapshot> {
  const [sessionRows, characterRows, checkRows, grantRows] = await Promise.all([
    db
      .select({ phase: sessions.phase, currentSceneId: sessions.currentSceneId })
      .from(sessions)
      .where(eq(sessions.id, sessionId)),
    db.select().from(sessionCharacters).where(eq(sessionCharacters.sessionId, sessionId)),
    db.select().from(checkRequests).where(eq(checkRequests.sessionId, sessionId)),
    db.select().from(handoutGrants).where(eq(handoutGrants.sessionId, sessionId)),
  ]);

  const session = sessionRows[0];
  if (!session) {
    throw new Error(`Session not found while capturing runtime snapshot: ${sessionId}`);
  }

  const grantIds = grantRows.map((grant) => grant.id);
  const [recipientRows, readRows] = grantIds.length
    ? await Promise.all([
        db
          .select({
            grantId: handoutGrantRecipients.grantId,
            characterId: handoutGrantRecipients.characterId,
          })
          .from(handoutGrantRecipients)
          .where(inArray(handoutGrantRecipients.grantId, grantIds)),
        db
          .select({
            grantId: handoutReads.grantId,
            playerId: handoutReads.playerId,
            userId: handoutReads.userId,
            readAt: handoutReads.readAt,
          })
          .from(handoutReads)
          .where(inArray(handoutReads.grantId, grantIds)),
      ])
    : [[], []];

  const recipientsByGrant = new Map<string, string[]>();
  for (const recipient of recipientRows) {
    const list = recipientsByGrant.get(recipient.grantId) ?? [];
    list.push(recipient.characterId);
    recipientsByGrant.set(recipient.grantId, list);
  }
  const readsByGrant = new Map<string, RuntimeSnapshotHandoutRead[]>();
  for (const read of readRows) {
    const list = readsByGrant.get(read.grantId) ?? [];
    list.push({ playerId: read.playerId, userId: read.userId, readAt: read.readAt });
    readsByGrant.set(read.grantId, list);
  }

  return {
    phase: session.phase,
    currentSceneId: session.currentSceneId ?? null,
    characters: characterRows.map((row) => ({
      characterId: row.characterId,
      kind: row.kind,
      currentExpressionKey: row.currentExpressionKey ?? null,
      stateJson: row.stateJson,
    })),
    checkRequests: checkRows.map((row) => ({
      id: row.id,
      characterId: row.characterId,
      skillKey: row.skillKey,
      difficulty: row.difficulty,
      bonusDice: row.bonusDice,
      penaltyDice: row.penaltyDice,
      hidden: row.hidden,
      sanLossExpression: row.sanLossExpression ?? null,
      status: row.status,
      resolvedCheckResultJson: row.resolvedCheckResultJson ?? null,
      createdAt: row.createdAt,
    })),
    handoutGrants: grantRows.map((row) => ({
      id: row.id,
      handoutId: row.handoutId,
      isPublic: row.isPublic,
      createdAt: row.createdAt,
      recipients: recipientsByGrant.get(row.id) ?? [],
      reads: readsByGrant.get(row.id) ?? [],
    })),
  };
}
