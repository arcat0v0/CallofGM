import { resolve } from "node:path";
import {
	readConcreteRuleIds,
	resolveBoundaryImport,
	scanProjectSources,
	visitBoundarySyntax,
} from "../../server/scripts/boundary-ast";

type BoundaryRule =
	| "rule-isolation"
	| "rule-id-literal"
	| "theme-store-isolation";

interface Violation {
	file: string;
	line: number;
	rule: BoundaryRule;
	value: string;
}

function isConcreteRule(
	path: string | null,
	ruleIds: ReadonlySet<string>,
): boolean {
	if (!path?.startsWith("rules/")) return false;
	const rule = path.split("/", 2)[1];
	return rule !== undefined && ruleIds.has(rule);
}

export async function checkClientBoundaries(
	clientRoot: string,
	sharedRoot: string,
): Promise<Violation[]> {
	const srcRoot = resolve(clientRoot, "src");
	const ruleIds = await readConcreteRuleIds(sharedRoot);
	const issues: Violation[] = [];
	await scanProjectSources(
		clientRoot,
		(file, filePath, source) => {
			const allowRuleIds = file.startsWith("i18n/");
			const inDefaultTheme = file.startsWith("themes/default/");
			visitBoundarySyntax(
				source,
				(specifier, names, line) => {
					const { local, shared } = resolveBoundaryImport(
						specifier,
						filePath,
						srcRoot,
						sharedRoot,
					);
					const sharedBarrel = shared === "" || shared === "index";
					if (
						isConcreteRule(local, ruleIds) ||
						isConcreteRule(shared, ruleIds) ||
						(sharedBarrel &&
							(names === "all" || names.some((name) => ruleIds.has(name))))
					) {
						issues.push({
							file,
							line,
							rule: "rule-isolation",
							value: specifier,
						});
					}
					if (
						inDefaultTheme &&
						(local === "stores/play-store" ||
							local === "stores/play" ||
							local?.startsWith("stores/play/"))
					) {
						issues.push({
							file,
							line,
							rule: "theme-store-isolation",
							value: specifier,
						});
					}
				},
				allowRuleIds
					? undefined
					: (value, line) => {
							if (ruleIds.has(value))
								issues.push({ file, line, rule: "rule-id-literal", value });
						},
			);
		},
		(file) => !file.startsWith("rules/"),
	);
	return issues;
}

if (import.meta.main) {
	const clientRoot = resolve(import.meta.dirname, "..");
	const issues = await checkClientBoundaries(
		clientRoot,
		resolve(clientRoot, "../../packages/shared/src"),
	);
	for (const { file, line, rule, value } of issues) {
		console.error(`${file}:${line}: ${rule} forbids ${JSON.stringify(value)}`);
	}
	if (issues.length > 0) process.exitCode = 1;
	else console.log("Client boundary checks passed.");
}
