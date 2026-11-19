import { resolve } from "node:path";
import {
	type ImportNames,
	isPackage,
	readConcreteRuleIds,
	resolveBoundaryImport,
	scanProjectSources,
	visitBoundarySyntax,
} from "./boundary-ast";

const genericRuleModules: Record<string, true> = {
	"rule-system": true,
	registry: true,
	"dice-engine": true,
	capabilities: true,
};

const realtimePersistence: Record<string, true> = {
	"modules/realtime/session-command-executor.ts": true,
	"modules/realtime/session-event-bus.ts": true,
	"modules/realtime/presence-service.ts": true,
	"modules/realtime/application/build-snapshot.ts": true,
	"modules/realtime/application/session-history.ts": true,
	"modules/realtime/application/history-recorder.ts": true,
	"modules/realtime/application/runtime-snapshot.ts": true,
	"modules/realtime/application/history-rewind-commands.ts": true,
	"modules/realtime/application/chat-message-mapper.ts": true,
	"modules/realtime/application/kicked-players.ts": true,
};

type Rule =
	| "module-entrypoint"
	| "rule-isolation"
	| "domain-layer"
	| "application-layer"
	| "persistence-layer";

interface Violation {
	file: string;
	line: number;
	rule: Rule;
	specifier: string;
}

function checkRules(
	file: string,
	specifier: string,
	local: string | null,
	shared: string | null,
	concreteRules: ReadonlySet<string>,
	names: ImportNames,
): Rule[] {
	const violations: Rule[] = [];
	const [root, module, layer, child] = file.split("/");
	const [targetRoot, targetModule, targetLayer, ...deeper] =
		local?.split("/") ?? [];
	const ownModule = root === "modules" && module === targetModule;
	if (
		targetRoot === "modules" &&
		targetModule &&
		!ownModule &&
		(deeper.length > 0 || (targetLayer && targetLayer !== "index"))
	) {
		violations.push("module-entrypoint");
	}

	const [sharedArea, sharedRule] = shared?.split("/") ?? [];
	const sharedBarrel = shared === "" || shared === "index";
	const serverRuleImport =
		targetRoot === "rules" &&
		(!targetModule ||
			deeper.length > 0 ||
			targetLayer !== undefined ||
			!Object.hasOwn(genericRuleModules, targetModule));
	const sharedRuleImport =
		(sharedArea === "rules" &&
			sharedRule !== undefined &&
			concreteRules.has(sharedRule)) ||
		(sharedBarrel &&
			(names === "all" || names.some((name) => concreteRules.has(name))));
	if (
		root !== "rules" &&
		(sharedRuleImport ||
			(serverRuleImport && file !== "bootstrap/container.ts"))
	) {
		violations.push("rule-isolation");
	}

	if (root !== "modules") return violations;
	const web = isPackage(specifier, "elysia");
	const drizzle = isPackage(specifier, "drizzle-orm");
	const db = local === "platform/db" || local?.startsWith("platform/db/");
	const schema =
		local === "platform/db/schema" || local?.startsWith("platform/db/schema/");
	if (
		layer === "domain" &&
		(web ||
			drizzle ||
			db ||
			(targetRoot === "modules" &&
				ownModule &&
				(targetLayer === "application" ||
					targetLayer === "transport" ||
					targetLayer === "infrastructure")))
	) {
		violations.push("domain-layer");
	}
	const application =
		layer === "application" ||
		(module === "realtime" && child === undefined && layer !== "index.ts");
	if (application && web) violations.push("application-layer");
	if (
		(application || layer === "transport") &&
		(drizzle || schema) &&
		!Object.hasOwn(realtimePersistence, file)
	) {
		violations.push("persistence-layer");
	}
	return violations;
}

export async function checkServerBoundaries(
	serverRoot: string,
	sharedRoot: string,
): Promise<Violation[]> {
	const srcRoot = resolve(serverRoot, "src");
	const concreteRules = await readConcreteRuleIds(sharedRoot);
	const issues: Violation[] = [];
	await scanProjectSources(serverRoot, (file, filePath, source) => {
		visitBoundarySyntax(source, (specifier, names, line) => {
			const { local, shared } = resolveBoundaryImport(
				specifier,
				filePath,
				srcRoot,
				sharedRoot,
				"@cogm/server",
			);
			for (const rule of checkRules(
				file,
				specifier,
				local,
				shared,
				concreteRules,
				names,
			)) {
				issues.push({ file, line, rule, specifier });
			}
		});
	});
	return issues;
}

if (import.meta.main) {
	const serverRoot = resolve(import.meta.dirname, "..");
	const issues = await checkServerBoundaries(
		serverRoot,
		resolve(serverRoot, "../../packages/shared/src"),
	);
	for (const { file, line, rule, specifier } of issues) {
		console.error(
			`${file}:${line}: ${rule} forbids ${JSON.stringify(specifier)}`,
		);
	}
	if (issues.length > 0) process.exitCode = 1;
	else console.log("Server boundary checks passed.");
}
