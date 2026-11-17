import { z } from "zod";

export const Coc7eCriticalVariant = z.enum([
	"rulebook",
	"simple",
	"flat5",
	"target5",
	"doubles",
]);
export type Coc7eCriticalVariant = z.infer<typeof Coc7eCriticalVariant>;

export const Coc7eCriticalVariantLabel: Record<
	Coc7eCriticalVariant,
	string
> = {
	rulebook: "规则书标准",
	simple: "简化：01 / 100",
	flat5: "固定 5%：01–05 / 96–100",
	target5: "成功内 5%：01–05 且 ≤ 目标",
	doubles: "对子判定（Delta Green 风格）",
};

export const Coc7eCriticalVariantDescription: Record<
	Coc7eCriticalVariant,
	string
> = {
	rulebook:
		"大成功 01；大失败 100，检定所需成功率低于 50% 时 96–100。",
	simple: "大成功 01、大失败 100，不随技能值变化。",
	flat5: "大成功 01–05、大失败 96–100，不随技能值变化。",
	target5:
		"大成功 01–05 且不超过目标值；大失败 100，或 96–99 且超过目标值。",
	doubles:
		"成功且掷出对子（11、22……99）或 01 为大成功；失败且掷出对子或 100 为大失败。",
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
