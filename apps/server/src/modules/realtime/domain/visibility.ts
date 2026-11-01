import type { ActorContext } from "@/modules/identity";

export type VisibilityScope =
  | { type: "public" }
  | { type: "gmOnly" }
  | { type: "pcPlayers" }
  | { type: "selectedPcIds"; pcIds: string[] }
  | { type: "connectionOnly"; connectionId: string };

export function checkVisibility(
  actor: ActorContext,
  claimedCharacterId: string | null,
  scope: VisibilityScope,
  connectionId: string
): boolean {
  if (actor.type === "gm") {
    return true;
  }
  switch (scope.type) {
    case "public":
      return true;
    case "gmOnly":
      return false;
    case "pcPlayers":
      return claimedCharacterId !== null;
    case "selectedPcIds":
      return claimedCharacterId !== null && scope.pcIds.includes(claimedCharacterId);
    case "connectionOnly":
      return connectionId === scope.connectionId;
    default:
      return false;
  }
}
