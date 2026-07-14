import { z } from "zod";

export const SessionStatus = z.enum(["waiting", "preparing", "active", "ended"]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const SessionStatusLabel: Record<SessionStatus, string> = {
  waiting: "等待开始",
  preparing: "准备中",
  active: "进行中",
  ended: "已结团",
};

export const SessionPhase = z.enum([
  "free_discussion",
  "performance_time",
  "forced_cg",
  "free_performance",
]);
export type SessionPhase = z.infer<typeof SessionPhase>;

export const SessionPhaseLabel: Record<SessionPhase, string> = {
  free_discussion: "自由讨论",
  performance_time: "演绎时间",
  forced_cg: "强制 CG",
  free_performance: "自由演绎",
};

export const CharacterRole = z.enum(["pc", "npc"]);
export type CharacterRole = z.infer<typeof CharacterRole>;

export const SeatRole = z.enum(["pc", "ob"]);
export type SeatRole = z.infer<typeof SeatRole>;

export const MessageChannel = z.enum(["ooc", "roleplay"]);
export type MessageChannel = z.infer<typeof MessageChannel>;
