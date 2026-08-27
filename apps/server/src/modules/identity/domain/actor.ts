export type ActorContext =
  | { type: "gm"; loginSessionId?: string }
  | { type: "player"; playerId: string };

export type SessionActorContext =
  | { type: "gm" }
  | { type: "player"; playerId: string; sessionId: string; seatRole: string; characterId?: string };
