import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkClientBoundaries } from "../scripts/check-boundaries";

test("enforces rule and theme boundaries with precise directory exemptions", async () => {
	const root = await mkdtemp(join(tmpdir(), "cogm-client-boundaries-"));
	try {
		const client = join(root, "client");
		const shared = join(root, "shared");
		await mkdir(join(shared, "rules/future-rule"), { recursive: true });
		await mkdir(join(shared, "rules/nextRule"), { recursive: true });
		await mkdir(join(client, "src"), { recursive: true });
		await Bun.write(
			join(client, "tsconfig.json"),
			JSON.stringify({
				include: ["src"],
				compilerOptions: { noLib: true, noResolve: true, jsx: "preserve" },
			}),
		);
		const files = {
			"features/positive.ts": [
				'import type { RuleId } from "@cogm/shared";',
				'import { getRuleComponent } from "@/rules/registry";',
				'import { model } from "@/rules/future-rule-adapter";',
				'const label = "future-rule.title";',
				'const other = "dnd5r";',
			],
			"features/negative.ts": [
				'import type { "future-rule" as Rule } from "@cogm/shared";',
				'export { type "future-rule" as Rule } from "@cogm/shared";',
				'import * as shared from "@cogm/shared/src/index.ts";',
				'export * from "../../../shared/index.js";',
				'type Rule = import("@cogm/shared").nextRule.Sheet;',
				'import("@cogm/shared");',
				'export { Rule } from "@/rules/future-rule/component.js";',
				'import type { Internal } from "../rules/future-rule";',
				"import(`../../../shared/rules/future-rule/script.js`);",
				'import("@cogm/shared/src/rules/future-rule");',
				'const ruleId: "future-rule" = `future-rule`;',
			],
			"i18n/messages.ts": [
				'export const messages = { "future-rule": "Future rule" };',
				'import { "future-rule" as rule } from "@cogm/shared";',
			],
			"i18n-copy/messages.ts": ['export const ruleId = "future-rule";'],
			"rules-copy/component.ts": ['export const ruleId = "future-rule";'],
			"rules/future-rule/component.ts": [
				'import { "future-rule" as rule } from "@cogm/shared";',
				'export const ruleId = "future-rule";',
			],
			"themes/default/slots/negative.tsx": [
				'import { usePlayStore } from "@/stores/play-store";',
				'export type { PlayState } from "../../../stores/play/types.js";',
				"import(`@/stores/play/slices/chat-slice`);",
				'type PlayState = import("@/stores/play-store").PlayState;',
			],
			"themes/default/slots/positive.tsx": [
				'import { usePlayDisplayStore } from "@/stores/play-display-store";',
				'import type { PlayStageCtx } from "@cogm/theme-sdk";',
			],
			"themes/default-copy/positive.ts": [
				'import { usePlayStore } from "@/stores/play-store";',
			],
		};
		for (const [file, lines] of Object.entries(files)) {
			const path = join(client, "src", file);
			await mkdir(dirname(path), { recursive: true });
			await Bun.write(path, lines.join("\n"));
		}
		const violations = await checkClientBoundaries(client, shared);
		expect(
			violations.map(({ file, line, rule }) => `${file}:${line}:${rule}`),
		).toEqual([
			...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
				(line) => `features/negative.ts:${line}:rule-isolation`,
			),
			"features/negative.ts:11:rule-id-literal",
			"features/negative.ts:11:rule-id-literal",
			"i18n-copy/messages.ts:1:rule-id-literal",
			"i18n/messages.ts:2:rule-isolation",
			"rules-copy/component.ts:1:rule-id-literal",
			...[1, 2, 3, 4].map(
				(line) =>
					`themes/default/slots/negative.tsx:${line}:theme-store-isolation`,
			),
		]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
