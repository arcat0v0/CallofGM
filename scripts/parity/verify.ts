type Probe =
  | { type: "path_exists"; glob: string; excludes?: string[] }
  | { type: "code_regex"; pattern: string; scope: string; excludes?: string[] };

type Feature = {
  id: string;
  category: string;
  name_zh: string;
  source: string;
  planned: boolean;
  weight: number;
  probes: Probe[];
  note_zh?: string;
};

type Category = { id: string; name_zh: string };
type Matrix = { version: number; scan_roots: string[]; categories: Category[]; features: Feature[] };

type Outcome = {
  id: string;
  category: string;
  name_zh: string;
  source: string;
  planned: boolean;
  weight: number;
  implemented: boolean;
  note_zh: string | null;
  matched: string[];
  missed: string[];
};

const EXCLUDES_DEFAULT = [
  "**/*.test.*",
  "docs/**",
  "research/**",
  "scripts/**",
  "node_modules/**",
  "dist/**",
  "data/**",
  "**/*.sqlite",
  "**/*.sqlite-*",
  "**/routeTree.gen.ts",
];
const SOURCES = new Set(["ccfolia", "echo", "both", "cogm"]);

const repoRoot = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

function fatal(message: string): never {
  console.error(`FATAL ${message}`);
  process.exit(1);
}

function globToRegExp(glob: string): RegExp {
  let pattern = "";
  let index = 0;
  while (index < glob.length) {
    const ch = glob[index] as string;
    if (ch === "*") {
      if (glob[index + 1] === "*") {
        if (glob[index + 2] === "/") {
          pattern += "(?:.*/)?";
          index += 3;
        } else {
          pattern += ".*";
          index += 2;
        }
      } else {
        pattern += "[^/]*";
        index += 1;
      }
      continue;
    }
    if (ch === "?") {
      pattern += "[^/]";
      index += 1;
      continue;
    }
    pattern += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    index += 1;
  }
  return new RegExp(`^${pattern}$`);
}

function isExcluded(relPath: string, excludes: string[]): boolean {
  return excludes.some((glob) => globToRegExp(glob).test(relPath));
}

function assertSafeRelPath(value: string, label: string): void {
  if (value.length === 0 || value.includes("\u0000") || value.startsWith("/") || value.startsWith("~") || value.includes("..")) {
    fatal(`unsafe ${label}: ${value}`);
  }
}

const scanFiles: string[] = [];
let scanLoaded = false;

async function loadScanFiles(): Promise<void> {
  if (scanLoaded) return;
  for (const root of ["apps", "packages"]) {
    const glob = new Bun.Glob("**/*");
    for await (const rel of glob.scan({ cwd: `${repoRoot}/${root}`, onlyFiles: true, dot: false })) {
      scanFiles.push(`${root}/${rel}`);
    }
  }
  scanLoaded = true;
}

async function pathExistsProbe(glob: string, excludes: string[]): Promise<boolean> {
  assertSafeRelPath(glob, "path_exists glob");
  await loadScanFiles();
  const re = globToRegExp(glob);
  return scanFiles.some((rel) => !isExcluded(rel, excludes) && re.test(rel));
}

async function codeRegexProbe(pattern: string, scope: string, excludes: string[]): Promise<boolean> {
  let re: RegExp;
  try {
    re = new RegExp(pattern);
  } catch {
    fatal(`invalid code_regex pattern: ${pattern}`);
  }
  const parts = scope.split(" ").filter((part) => part.length > 0);
  if (parts.length === 0) {
    fatal("code_regex scope must not be empty");
  }
  for (const part of parts) {
    assertSafeRelPath(part, "code_regex scope");
  }
  await loadScanFiles();
  for (const rel of scanFiles) {
    const inScope = parts.some((part) => rel === part || rel.startsWith(`${part}/`));
    if (!inScope || isExcluded(rel, excludes)) continue;
    let text: string;
    try {
      text = await Bun.file(`${repoRoot}/${rel}`).text();
    } catch {
      continue;
    }
    if (re.test(text)) return true;
  }
  return false;
}

function probeLabel(probe: Probe): string {
  if (probe.type === "path_exists") return `path_exists:${probe.glob}`;
  return `code_regex:${probe.pattern}`;
}

function assertFeature(raw: unknown, index: number): Feature {
  if (typeof raw !== "object" || raw === null) fatal(`feature #${index} is not an object`);
  const f = raw as Record<string, unknown>;
  for (const key of ["id", "category", "name_zh", "source"]) {
    if (typeof f[key] !== "string" || (f[key] as string).length === 0) {
      fatal(`feature #${index} field ${key} must be a non-empty string`);
    }
  }
  if (typeof f.planned !== "boolean") fatal(`feature ${String(f.id)} planned must be boolean`);
  if (f.weight !== 1 && f.weight !== 2 && f.weight !== 3) fatal(`feature ${String(f.id)} weight must be 1, 2 or 3`);
  if (!Array.isArray(f.probes)) fatal(`feature ${String(f.id)} probes must be an array`);
  if (!SOURCES.has(f.source as string)) fatal(`feature ${String(f.id)} unknown source ${String(f.source)}`);
  const probes: Probe[] = [];
  for (const rawProbe of f.probes as unknown[]) {
    if (typeof rawProbe !== "object" || rawProbe === null) fatal(`feature ${String(f.id)} probe is not an object`);
    const probe = rawProbe as Record<string, unknown>;
    if (probe.type === "path_exists") {
      if (typeof probe.glob !== "string") fatal(`feature ${String(f.id)} path_exists probe needs glob`);
      const entry: Probe = { type: "path_exists", glob: probe.glob };
      if (Array.isArray(probe.excludes)) {
        entry.excludes = probe.excludes.filter((item): item is string => typeof item === "string");
      }
      probes.push(entry);
    } else if (probe.type === "code_regex") {
      if (typeof probe.pattern !== "string" || typeof probe.scope !== "string") {
        fatal(`feature ${String(f.id)} code_regex probe needs pattern and scope`);
      }
      const entry: Probe = { type: "code_regex", pattern: probe.pattern, scope: probe.scope };
      if (Array.isArray(probe.excludes)) {
        entry.excludes = probe.excludes.filter((item): item is string => typeof item === "string");
      }
      probes.push(entry);
    } else {
      fatal(`feature ${String(f.id)} unknown probe type ${String(probe.type)}`);
    }
  }
  if (f.planned && probes.length === 0) fatal(`planned feature ${String(f.id)} has no probes`);
  const feature: Feature = {
    id: f.id as string,
    category: f.category as string,
    name_zh: f.name_zh as string,
    source: f.source as string,
    planned: f.planned as boolean,
    weight: f.weight as number,
    probes,
  };
  if (typeof f.note_zh === "string") feature.note_zh = f.note_zh;
  return feature;
}

async function main(): Promise<void> {
  const matrixRaw = await Bun.file(`${repoRoot}/scripts/parity/feature-matrix.json`).json();
  if (typeof matrixRaw !== "object" || matrixRaw === null) fatal("matrix is not an object");
  const matrix = matrixRaw as Matrix;
  if (!Array.isArray(matrix.categories) || !Array.isArray(matrix.features)) {
    fatal("matrix categories and features must be arrays");
  }
  const features = matrix.features.map((feature, index) => assertFeature(feature, index));
  const categoryIds = new Set(
    matrix.categories
      .filter((category): category is Category => typeof category === "object" && category !== null && typeof category.id === "string")
      .map((category) => category.id)
  );
  const seen = new Set<string>();
  for (const feature of features) {
    if (!categoryIds.has(feature.category)) fatal(`feature ${feature.id} references unknown category ${feature.category}`);
    if (seen.has(feature.id)) fatal(`duplicate feature id ${feature.id}`);
    seen.add(feature.id);
  }

  await loadScanFiles();
  const outcomes: Outcome[] = [];
  for (const feature of features) {
    const matched: string[] = [];
    const missed: string[] = [];
    if (feature.planned) {
      for (const probe of feature.probes) {
        const excludes = probe.excludes ?? EXCLUDES_DEFAULT;
        const hit =
          probe.type === "path_exists"
            ? await pathExistsProbe(probe.glob, excludes)
            : await codeRegexProbe(probe.pattern, probe.scope, excludes);
        if (hit) matched.push(probeLabel(probe));
        else missed.push(probeLabel(probe));
      }
    }
    outcomes.push({
      id: feature.id,
      category: feature.category,
      name_zh: feature.name_zh,
      source: feature.source,
      planned: feature.planned,
      weight: feature.weight,
      implemented: feature.planned && missed.length === 0,
      note_zh: feature.note_zh ?? null,
      matched,
      missed,
    });
  }

  const plannedOutcomes = outcomes.filter((outcome) => outcome.planned);
  const implementedPlanned = plannedOutcomes.filter((outcome) => outcome.implemented);
  const plannedWeight = plannedOutcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
  const implementedWeight = implementedPlanned.reduce((sum, outcome) => sum + outcome.weight, 0);
  const score = plannedWeight > 0 ? Math.round((implementedWeight / plannedWeight) * 1000) / 10 : 0;

  const competitorOutcomes = outcomes.filter(
    (outcome) => outcome.source === "ccfolia" || outcome.source === "echo" || outcome.source === "both"
  );
  const competitorWeight = competitorOutcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
  const competitorImplementedWeight = competitorOutcomes
    .filter((outcome) => outcome.planned && outcome.implemented)
    .reduce((sum, outcome) => sum + outcome.weight, 0);
  const competitorScore =
    competitorWeight > 0 ? Math.round((competitorImplementedWeight / competitorWeight) * 1000) / 10 : 0;

  console.log(`METRIC competitor_alignment_score=${competitorScore.toFixed(1)}`);
  console.log(`METRIC feature_parity_score=${score.toFixed(1)}`);
  console.log(`METRIC features_total_planned=${plannedOutcomes.length}`);
  console.log(`METRIC features_implemented=${implementedPlanned.length}`);
  console.log(`METRIC features_missing=${plannedOutcomes.length - implementedPlanned.length}`);
  console.log(`METRIC features_competitor_only=${outcomes.length - plannedOutcomes.length}`);
  for (const category of matrix.categories) {
    const rows = plannedOutcomes.filter((outcome) => outcome.category === category.id);
    const totalWeight = rows.reduce((sum, outcome) => sum + outcome.weight, 0);
    const implWeight = rows.filter((outcome) => outcome.implemented).reduce((sum, outcome) => sum + outcome.weight, 0);
    const catScore = totalWeight > 0 ? Math.round((implWeight / totalWeight) * 1000) / 10 : 0;
    console.log(`METRIC cat_${category.id}=${catScore.toFixed(1)}`);
  }

  console.log("");
  for (const outcome of outcomes) {
    const verdict = outcome.planned ? (outcome.implemented ? "implemented" : "missing") : "not-planned";
    const probed = outcome.planned ? ` matched=[${outcome.matched.join("; ")}] missed=[${outcome.missed.join("; ")}]` : "";
    const note = outcome.note_zh === null ? "" : ` note=${outcome.note_zh}`;
    console.log(`DETAIL ${verdict} src=${outcome.source} w=${outcome.weight} cat=${outcome.category} id=${outcome.id} ${outcome.name_zh}${probed}${note}`);
  }
  process.exit(0);
}

try {
  await main();
} catch (error) {
  fatal(error instanceof Error ? error.message : String(error));
}
