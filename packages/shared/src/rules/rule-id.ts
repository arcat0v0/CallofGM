import { z } from "zod";

export const RuleId = z.enum(["coc7e"]);
export type RuleId = z.infer<typeof RuleId>;

export const RuleIdLabel: Record<RuleId, string> = {
  coc7e: "CoC 第 7 版",
};
