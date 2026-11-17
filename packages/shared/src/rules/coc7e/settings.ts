import { z } from "zod";

export const Coc7eCriticalVariant = z.enum([
	"rulebook",
	"simple",
	"wide",
	"doubles",
	"strict",
]);
export type Coc7eCriticalVariant = z.infer<typeof Coc7eCriticalVariant>;

export const Coc7eCriticalVariantLabel: Record<
	Coc7eCriticalVariant,
	string
> = {
	rulebook: "规则书标准",
	simple: "简化版",
	wide: "1–5 / 96–100",
	doubles: "对子判定（实验性）",
	strict: "98–100 变体",
};

export const Coc7eCriticalVariantDescription: Record<
	Coc7eCriticalVariant,
	string
> = {
	rulebook:
		"大成功 01；大失败 100，技能小于 50 时 96–100。",
	simple: "大成功 01；大失败 100。",
	wide: "大成功 01–05；大失败 96–100。",
	doubles:
		"十位与个位相同且成功为大成功，相同且失败为大失败；会覆盖极难/困难判级。",
	strict:
		"大成功 01；技能 50 以上时 98–100 大失败，50 以下时 96–100 大失败。",
};

export const Coc7eSessionRules = z.object({
	allowLuckSpend: z.boolean().default(true),
	criticalVariant: Coc7eCriticalVariant.default("rulebook"),
});
export type Coc7eSessionRules = z.output<typeof Coc7eSessionRules>;

export const Coc7eSessionRulesDefaults: Coc7eSessionRules = {
	allowLuckSpend: true,
	criticalVariant: "rulebook",
};

export function parseCoc7eSessionRules(value: unknown): Coc7eSessionRules {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return { ...Coc7eSessionRulesDefaults };
	}
	return Coc7eSessionRules.parse({
		...Coc7eSessionRulesDefaults,
		...(value as Record<string, unknown>),
	});
}
