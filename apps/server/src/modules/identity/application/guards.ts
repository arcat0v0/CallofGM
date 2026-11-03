import type { ActorContext } from "../domain/actor";
import { AdminRequiredError, AuthRequiredError, ForbiddenError, GmRequiredError, PlayerRequiredError } from "../domain/errors";
import type { SeatHolderInput } from "@/modules/sessions";

export function isGm(actor: ActorContext | null): boolean {
  return actor?.type === "user" && actor.role === "gm";
}

export function isAdmin(actor: ActorContext | null): boolean {
  return actor?.type === "user" && actor.role === "admin";
}

export function isPl(actor: ActorContext | null): boolean {
  return actor?.type === "user" && actor.role === "pl";
}

export function requireActor(actor: ActorContext | null): ActorContext {
  if (!actor) {
    throw new AuthRequiredError();
  }
  return actor;
}

export function requireGm(actor: ActorContext | null): { type: "user"; userId: string; role: "gm" } {
  if (!actor) {
    throw new AuthRequiredError();
  }
  if (actor.type !== "user" || actor.role !== "gm") {
    throw new GmRequiredError();
  }
  return actor as { type: "user"; userId: string; role: "gm" };
}

export function requireAdmin(actor: ActorContext | null): { type: "user"; userId: string; role: "admin" } {
  if (!actor) {
    throw new AuthRequiredError();
  }
  if (actor.type !== "user" || actor.role !== "admin") {
    throw new AdminRequiredError();
  }
  return actor as { type: "user"; userId: string; role: "admin" };
}

export function requirePl(actor: ActorContext | null): { type: "user"; userId: string; role: "pl" } {
  if (!actor) {
    throw new AuthRequiredError();
  }
  if (actor.type !== "user" || actor.role !== "pl") {
    throw new PlayerRequiredError();
  }
  return actor as { type: "user"; userId: string; role: "pl" };
}

export function holderOfActor(actor: ActorContext): SeatHolderInput {
  return actor.type === "user"
    ? { holderKind: "user", userId: actor.userId, playerId: null }
    : { holderKind: "anonymous", userId: null, playerId: actor.playerId };
}

export function requireSeatHolder(actor: ActorContext | null): SeatHolderInput {
  if (!actor) {
    throw new AuthRequiredError();
  }
  if (actor.type === "user") {
    if (actor.role === "admin") {
      throw new ForbiddenError("Administrators do not take seats");
    }
    return { holderKind: "user", userId: actor.userId, playerId: null };
  }
  return { holderKind: "anonymous", userId: null, playerId: actor.playerId };
}
