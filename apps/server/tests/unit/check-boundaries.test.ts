import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkServerBoundaries } from "../../scripts/check-boundaries";

test("server guard enforces import boundaries and exact exception paths", async () => {
	const root = await mkdtemp(join(tmpdir(), "cogm-boundaries-"));
	try {
		const server = join(root, "server");
		const shared = join(root, "shared");
		await mkdir(join(shared, "rules/future-rule"), { recursive: true });
		await mkdir(join(server, "src"), { recursive: true });
		await Bun.write(
			join(server, "tsconfig.json"),
			JSON.stringify({
				include: ["src"],
				compilerOptions: { noLib: true, noResolve: true },
			}),
		);
		const files = {
			"modules/gameplay/domain/positive.ts": [
				'import type { A } from "@/modules/other/index.ts";',
				'export { B } from "../../other";',
				'import type { General } from "@cogm/shared";',
				'import { Registry } from "@/rules/registry";',
				'// import { sql } from "drizzle-orm";',
				'const docs = `export type { Elysia } from "elysia"`;',
				String.raw`const expression = /import\("drizzle-orm"\)/;`,
			],
			"modules/gameplay/domain/negative.ts": [
				'import type { Elysia } from "elysia";',
				'export type { A } from "drizzle-orm/sqlite-core";',
				'export { save } from "../application/save";',
				'import "@/platform/db/client";',
				'export type { B } from "../../other/index/nested";',
			],
			"modules/gameplay/transport/negative.ts": [
				'const rows = import("@/platform/db/schema/sessions");',
				'import Sql = require("drizzle-orm");',
				'export type { Other } from "@cogm/server/src/modules/other/domain/other.ts";',
			],
			"modules/gameplay/application/rules.ts": [
				'import { type "future-rule" as Rule } from "@cogm/shared";',
				'export { "future-rule" as rule } from "@cogm/shared/index.ts";',
				'const module = await import("@cogm/shared/src/rules/future-rule");',
				'export * from "@cogm/shared";',
				'import * as shared from "@cogm/shared";',
				'const context = import("../../../../../shared/rules/future-rule");',
				'import type { A } from "@/rules/future-rule/index";',
				'type Context = typeof import("@cogm/shared").RuleListResponse;',
				"const other = require(`@/platform/db/schema`);",
				'const checks = import("@cogm/shared");',
				'type RuleContext = typeof import("@cogm/shared")["General"];',
			],
			"modules/realtime/application/build-snapshot.ts": [
				'import { sql } from "drizzle-orm";',
				'import { rows } from "@/platform/db/schema";',
				'import type { Elysia } from "elysia";',
			],
			"modules/realtime/application/build-snapshot-copy.ts": [
				'import { sql } from "drizzle-orm";',
			],
			"modules/realtime/connection-registry.ts": [
				'import { sql } from "drizzle-orm";',
			],
			"bootstrap/container.ts": ['import { Rule } from "@/rules/future-rule";'],
			"rules/future-rule/index.ts": [
				'import { "future-rule" as rule } from "@cogm/shared";',
			],
		};
		for (const [file, lines] of Object.entries(files)) {
			const path = join(server, "src", file);
			await mkdir(dirname(path), { recursive: true });
			await Bun.write(path, lines.join("\n"));
		}
		const violations = await checkServerBoundaries(server, shared);
		expect(
			violations
				.map(({ file, line, rule }) => `${file}:${line}:${rule}`)
				.sort(),
		).toEqual(
			[
				"modules/gameplay/domain/negative.ts:1:domain-layer",
				"modules/gameplay/domain/negative.ts:2:domain-layer",
				"modules/gameplay/domain/negative.ts:3:domain-layer",
				"modules/gameplay/domain/negative.ts:4:domain-layer",
				"modules/gameplay/domain/negative.ts:5:module-entrypoint",
				"modules/gameplay/transport/negative.ts:1:persistence-layer",
				"modules/gameplay/transport/negative.ts:2:persistence-layer",
				"modules/gameplay/transport/negative.ts:3:module-entrypoint",
				"modules/gameplay/application/rules.ts:1:rule-isolation",
				"modules/gameplay/application/rules.ts:2:rule-isolation",
				"modules/gameplay/application/rules.ts:3:rule-isolation",
				"modules/gameplay/application/rules.ts:4:rule-isolation",
				"modules/gameplay/application/rules.ts:5:rule-isolation",
				"modules/gameplay/application/rules.ts:6:rule-isolation",
				"modules/gameplay/application/rules.ts:7:rule-isolation",
				"modules/gameplay/application/rules.ts:9:persistence-layer",
				"modules/gameplay/application/rules.ts:10:rule-isolation",
				"modules/gameplay/application/rules.ts:11:rule-isolation",
				"modules/realtime/application/build-snapshot.ts:3:application-layer",
				"modules/realtime/application/build-snapshot-copy.ts:1:persistence-layer",
				"modules/realtime/connection-registry.ts:1:persistence-layer",
			].sort(),
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
