import { readdir } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { Glob } from "bun";
import {
	type Node,
	type SourceFile,
	SyntaxKind,
} from "typescript/unstable/ast";
import {
	isCallExpression,
	isExportDeclaration,
	isExternalModuleReference,
	isIdentifier,
	isImportDeclaration,
	isImportTypeNode,
	isLiteralTypeNode,
	isNamedImportsOrExports,
	isPropertyAccessExpression,
	isQualifiedName,
	isStringLiteralLikeNode,
} from "typescript/unstable/ast/is";
import { API } from "typescript/unstable/async";

export type ImportNames = readonly string[] | "all";

export async function readConcreteRuleIds(
	sharedRoot: string,
): Promise<ReadonlySet<string>> {
	const entries = await readdir(resolve(sharedRoot, "rules"), {
		withFileTypes: true,
	});
	return new Set(
		entries.filter((entry) => entry.isDirectory()).map(({ name }) => name),
	);
}

export function isPackage(specifier: string, name: string): boolean {
	return specifier === name || specifier.startsWith(`${name}/`);
}

function modulePathWithin(root: string, path: string): string | null {
	const subpath = relative(root, path).split(sep).join("/");
	return subpath === ".." || subpath.startsWith("../")
		? null
		: subpath.replace(/(?:\.d)?\.[cm]?[jt]sx?$/, "");
}

function packagePath(root: string, specifier: string, name: string): string {
	return resolve(
		root,
		specifier.slice(name.length + 1).replace(/^src(?:\/|$)/, ""),
	);
}

export function resolveBoundaryImport(
	specifier: string,
	filePath: string,
	srcRoot: string,
	sharedRoot: string,
	appPackage?: string,
): { local: string | null; shared: string | null } {
	let absolute: string;
	if (specifier.startsWith("@/")) {
		absolute = resolve(srcRoot, specifier.slice(2));
	} else if (specifier.startsWith(".")) {
		absolute = resolve(dirname(filePath), specifier);
	} else if (appPackage && isPackage(specifier, appPackage)) {
		absolute = packagePath(srcRoot, specifier, appPackage);
	} else if (isPackage(specifier, "@cogm/shared")) {
		absolute = packagePath(sharedRoot, specifier, "@cogm/shared");
	} else {
		return { local: null, shared: null };
	}
	return {
		local: modulePathWithin(srcRoot, absolute),
		shared: modulePathWithin(sharedRoot, absolute),
	};
}

function isLiteralLoader(node: Node): boolean {
	if (node.kind === SyntaxKind.ImportKeyword) return true;
	if (isIdentifier(node)) return node.text === "require";
	return (
		isPropertyAccessExpression(node) &&
		node.name.text === "require" &&
		node.expression.kind === SyntaxKind.MetaProperty
	);
}

function visitDependency(
	node: Node,
	visit: (source: Node, names: ImportNames) => void,
): void {
	if (isImportDeclaration(node) || isExportDeclaration(node)) {
		if (!node.moduleSpecifier) return;
		const bindings = isImportDeclaration(node)
			? node.importClause?.namedBindings
			: node.exportClause;
		if (bindings && isNamedImportsOrExports(bindings)) {
			visit(
				node.moduleSpecifier,
				bindings.elements.map(
					({ propertyName, name }) => (propertyName ?? name).text,
				),
			);
		} else {
			visit(
				node.moduleSpecifier,
				bindings || isExportDeclaration(node) ? "all" : [],
			);
		}
	} else if (isImportTypeNode(node) && isLiteralTypeNode(node.argument)) {
		let name = node.qualifier;
		while (name && isQualifiedName(name)) name = name.left;
		visit(node.argument.literal, name ? [name.text] : "all");
	} else if (isCallExpression(node) && isLiteralLoader(node.expression)) {
		const argument = node.arguments[0];
		if (argument) visit(argument, "all");
	} else if (isExternalModuleReference(node)) {
		visit(node.expression, "all");
	}
}

export function visitBoundarySyntax(
	source: SourceFile,
	onDependency: (specifier: string, names: ImportNames, line: number) => void,
	onLiteral?: (value: string, line: number) => void,
): void {
	const lineOf = (node: Node) =>
		source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
	const dependency = (node: Node, names: ImportNames) => {
		if (isStringLiteralLikeNode(node))
			onDependency(node.text, names, lineOf(node));
	};
	function visit(node: Node, parentKind?: SyntaxKind): void {
		visitDependency(node, dependency);
		if (
			onLiteral &&
			parentKind !== SyntaxKind.ImportSpecifier &&
			parentKind !== SyntaxKind.ExportSpecifier &&
			isStringLiteralLikeNode(node)
		) {
			onLiteral(node.text, lineOf(node));
		}
		node.forEachChild((child) => visit(child, node.kind));
	}
	visit(source);
}

export async function scanProjectSources(
	projectRoot: string,
	visit: (file: string, filePath: string, source: SourceFile) => void,
	include?: (file: string) => boolean,
): Promise<void> {
	const srcRoot = resolve(projectRoot, "src");
	const api = new API();
	try {
		const configPath = resolve(projectRoot, "tsconfig.json");
		const snapshot = await api.updateSnapshot({ openProjects: [configPath] });
		const project = snapshot.getProject(configPath);
		if (!project)
			throw new Error(`Cannot open TypeScript project ${configPath}`);
		const glob = new Glob("**/*.{ts,tsx,mts,cts}");
		const files = await Array.fromAsync(
			glob.scan({ cwd: srcRoot, onlyFiles: true }),
		);
		for (const file of files.sort()) {
			if (include && !include(file)) continue;
			const filePath = resolve(srcRoot, file);
			const source = await project.program.getSourceFile(filePath);
			if (!source)
				throw new Error(`Cannot read TypeScript AST for ${filePath}`);
			visit(file, filePath, source);
		}
	} finally {
		await api.close();
	}
}
