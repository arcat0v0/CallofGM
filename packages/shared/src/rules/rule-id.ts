import { z } from "zod";

export const RuleId = z
	.string()
	.regex(
		/^[a-z0-9][a-z0-9-]{0,49}$/,
		"ruleId must be lowercase alphanumeric with hyphens",
	);
export type RuleId = z.infer<typeof RuleId>;

export const RuleMetadata = z.object({
	id: RuleId,
	name: z.string().min(1),
	version: z.string().min(1),
	apiVersion: z.number().int().positive(),
	description: z.string(),
	permanentSheetFields: z.array(z.string()),
});
export type RuleMetadata = z.infer<typeof RuleMetadata>;

export const RuleListResponse = z.array(RuleMetadata);
export type RuleListResponse = z.infer<typeof RuleListResponse>;
