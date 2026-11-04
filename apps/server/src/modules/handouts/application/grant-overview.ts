import type {
	HandoutGrantDetailDto,
	HandoutGrantRecipientDto,
} from "@cogm/shared";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
	handoutGrantRecipients,
	handoutGrants,
	handoutReads,
	handouts,
	sessionCharacters,
	sessionClaims,
} from "@/platform/db/schema";

function holderKey(
	holderKind: string | null,
	userId: string | null,
	playerId: string | null,
): string | null {
	if (holderKind === "user" && userId) {
		return `user:${userId}`;
	}
	if (holderKind === "anonymous" && playerId) {
		return `player:${playerId}`;
	}
	return null;
}

export async function buildHandoutGrantOverview(
	db: DbClient,
	sessionId: string,
): Promise<HandoutGrantDetailDto[]> {
	const grants = await db
		.select()
		.from(handoutGrants)
		.where(eq(handoutGrants.sessionId, sessionId))
		.orderBy(asc(handoutGrants.createdAt), asc(handoutGrants.id));
	if (grants.length === 0) {
		return [];
	}

	const grantIds = grants.map((grant) => grant.id);
	const handoutIds = [...new Set(grants.map((grant) => grant.handoutId))];
	const [recipientRows, readRows, handoutRows, characterRows, claimRows] =
		await Promise.all([
			db
				.select()
				.from(handoutGrantRecipients)
				.where(inArray(handoutGrantRecipients.grantId, grantIds)),
			db
				.select()
				.from(handoutReads)
				.where(inArray(handoutReads.grantId, grantIds)),
			db.select().from(handouts).where(inArray(handouts.id, handoutIds)),
			db
				.select({
					characterId: sessionCharacters.characterId,
					name: sessionCharacters.name,
				})
				.from(sessionCharacters)
				.where(eq(sessionCharacters.sessionId, sessionId)),
			db
				.select()
				.from(sessionClaims)
				.where(
					and(
						eq(sessionClaims.sessionId, sessionId),
						isNull(sessionClaims.releasedAt),
					),
				),
		]);

	const titleByHandout = new Map(
		handoutRows.map((handout) => [handout.id, handout.title]),
	);
	const nameByCharacter = new Map(
		characterRows.map((character) => [character.characterId, character.name]),
	);
	const claimByCharacter = new Map<
		string,
		{ holderKind: "user" | "anonymous"; holderId: string }
	>();
	const activeHolderKeys = new Set<string>();
	for (const claim of claimRows) {
		const key = holderKey(claim.holderKind, claim.userId, claim.playerId);
		if (key) {
			activeHolderKeys.add(key);
		}
		if (!claim.characterId) {
			continue;
		}
		const holderKind = claim.holderKind === "user" ? "user" : "anonymous";
		const holderId =
			holderKind === "user" ? (claim.userId ?? "") : (claim.playerId ?? "");
		claimByCharacter.set(claim.characterId, {
			holderKind,
			holderId,
		});
	}

	const recipientIdsByGrant = new Map<string, string[]>();
	for (const recipient of recipientRows) {
		const list = recipientIdsByGrant.get(recipient.grantId) ?? [];
		list.push(recipient.characterId);
		recipientIdsByGrant.set(recipient.grantId, list);
	}
	const readKeysByGrant = new Map<string, Set<string>>();
	for (const read of readRows) {
		const key = holderKey(
			read.userId ? "user" : "anonymous",
			read.userId,
			read.playerId,
		);
		if (!key) {
			continue;
		}
		const set = readKeysByGrant.get(read.grantId) ?? new Set<string>();
		set.add(key);
		readKeysByGrant.set(read.grantId, set);
	}

	return grants.map((grant) => {
		const isPublic = grant.isPublic === 1;
		const readerKeys = readKeysByGrant.get(grant.id) ?? new Set<string>();
		if (isPublic) {
			const readCount = [...readerKeys].filter((key) =>
				activeHolderKeys.has(key),
			).length;
			return {
				grantId: grant.id,
				handoutId: grant.handoutId,
				title: titleByHandout.get(grant.handoutId) ?? "",
				isPublic,
				grantedAt: grant.createdAt,
				recipients: [],
				readCount,
				audienceCount: activeHolderKeys.size,
			};
		}

		const recipients: HandoutGrantRecipientDto[] = (
			recipientIdsByGrant.get(grant.id) ?? []
		).map((characterId) => {
			const claim = claimByCharacter.get(characterId) ?? null;
			const key = claim
				? `${claim.holderKind === "user" ? "user" : "player"}:${claim.holderId}`
				: null;
			return {
				characterId,
				name: nameByCharacter.get(characterId) ?? "",
				read: key ? readerKeys.has(key) : false,
			};
		});
		return {
			grantId: grant.id,
			handoutId: grant.handoutId,
			title: titleByHandout.get(grant.handoutId) ?? "",
			isPublic,
			grantedAt: grant.createdAt,
			recipients,
			readCount: recipients.filter((recipient) => recipient.read).length,
			audienceCount: recipients.length,
		};
	});
}
