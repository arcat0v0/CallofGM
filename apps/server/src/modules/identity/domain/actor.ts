export type UserRole = "admin" | "gm" | "pl";

export type ActorContext =
  | { type: "user"; userId: string; role: UserRole; loginSessionId: string; username: string }
  | { type: "player"; playerId: string };

export type SeatHolder =
  | { holderKind: "user"; userId: string }
  | { holderKind: "anonymous"; playerId: string };

export function holderKey(holder: SeatHolder): string {
  return holder.holderKind === "user" ? `user:${holder.userId}` : `player:${holder.playerId}`;
}

export function holderOf(actor: ActorContext): SeatHolder | null {
  return actor.type === "user" ? { holderKind: "user", userId: actor.userId } : { holderKind: "anonymous", playerId: actor.playerId };
}

export type SessionActorContext =
  | { type: "user"; userId: string; role: UserRole }
  | { type: "player"; playerId: string; sessionId: string; seatRole: string; characterId?: string };
