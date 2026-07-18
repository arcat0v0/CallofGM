import { Glob } from "bun";
import { readFile } from "fs/promises";
import { dirname, resolve, relative } from "path";

const srcRoot = resolve(import.meta.dirname ?? ".", "../src");

const glob = new Glob("**/*.ts");
const files = await Array.fromAsync(glob.scan({
  cwd: srcRoot,
  onlyFiles: true,
}));

let hasErrors = false;

for (const file of files) {
  if (!file.endsWith(".ts")) continue;
  const filePath = resolve(srcRoot, file);
  const fileContent = await readFile(filePath, "utf-8");
  const fileDir = dirname(filePath);

  const importRegex = /(?:import|export)\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(fileContent)) !== null) {
    const importPath = match[1] ?? "";

    let resolvedImport: string;
    if (importPath.startsWith("@/")) {
      // 别名导入：@/ 映射到 src/
      resolvedImport = resolve(srcRoot, importPath.slice(2));
    } else if (importPath.startsWith(".")) {
      resolvedImport = resolve(fileDir, importPath);
    } else {
      continue;
    }

    const relativeToSrc = relative(srcRoot, resolvedImport);

    const fileParts = file.split("/");
    const isFileInModule = fileParts[0] === "modules" && fileParts.length > 1;
    const fileModule = isFileInModule ? fileParts[1] : null;

    const importParts = relativeToSrc.split("/");
    const isImportInModule = importParts[0] === "modules" && importParts.length > 1;
    const importModule = isImportInModule ? importParts[1] : null;

    if (isImportInModule && importModule !== fileModule) {
      if (importParts.length > 2) {
        console.error(`Error in ${file}: Cross-module import to internal path "${importPath}" (resolved: ${relativeToSrc}). Only imports from the module root index are allowed.`);
        hasErrors = true;
      }
    }

    if (relativeToSrc.startsWith("rules/") && !file.startsWith("rules/") && file !== "bootstrap/container.ts") {
      const rulesParts = relativeToSrc.split("/");
      // 仅允许依赖规则抽象层与通用引擎；具体规则实现（如 coc7e）禁止被通用代码导入
      const genericAllowed = new Set(["rule-system", "registry", "dice-engine"]);
      if (rulesParts[1] && !genericAllowed.has(rulesParts[1])) {
        console.error(`Error in ${file}: Cannot import concrete rule system "${importPath}" (resolved: ${relativeToSrc}). General code must only depend on RuleSystem and RuleRegistry.`);
        hasErrors = true;
      }
    }
  }
}

if (hasErrors) {
  process.exit(1);
} else {
  console.log("Boundary checks passed successfully.");
}
