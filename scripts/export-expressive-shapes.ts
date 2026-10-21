import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve(
  process.argv[2] ?? "/tmp/cogm-m3-sources/material_new_shapes",
);
const dart = process.argv[3] ?? "/tmp/cogm-m3-sources/dart-sdk/bin/dart";
const target = "/tmp/cogm-shape-export";
await mkdir(target, { recursive: true });
await cp(`${source}/lib`, `${target}/lib`, { recursive: true });
const shapesFile = `${target}/lib/src/shapes/shapes.dart`;
await Bun.write(
  shapesFile,
  (await Bun.file(shapesFile).text()).replace("import 'dart:ui';", ""),
);
const utils = `${target}/lib/src/shapes/utils.dart`;
await Bun.write(
  utils,
  (await Bun.file(utils).text()).split(
    "extension RoundedPolygonToPathExtension",
  )[0],
);
await Bun.write(
  `${target}/pubspec.yaml`,
  "name: material_new_shapes\nenvironment:\n  sdk: ^3.6.0\ndependencies:\n  meta: 1.15.0\n  vector_math: 2.1.4\n",
);
const sourceText = await Bun.file(
  `${source}/lib/src/material_shapes.dart`,
).text();
const names = [...sourceText.matchAll(/static final (\w+) =/g)]
  .map((match) => match[1])
  .filter((name) => name !== "all");
await Bun.write(
  `${target}/export.dart`,
  `import 'dart:convert';
import 'package:material_new_shapes/src/material_shapes.dart';
import 'package:material_new_shapes/src/shapes/shapes.dart';
void main() {
  final shapes = <String, RoundedPolygon>{${names.map((name) => `'${name}': MaterialShapes.${name}`).join(",")}};
  final result = <String, dynamic>{};
  for (final entry in shapes.entries) {
    final cubics = entry.value.cubics;
    result[entry.key] = cubics.map((c) => [c.anchor0X,c.anchor0Y,c.control0X,c.control0Y,c.control1X,c.control1Y,c.anchor1X,c.anchor1Y]).toList();
  }
  print(jsonEncode(result));
}
`,
);
for (const args of [
  ["pub", "get"],
  ["run", "export.dart"],
]) {
  const process = Bun.spawn([dart, ...args], {
    cwd: target,
    stdout: "pipe",
    stderr: "inherit",
  });
  const output = await new Response(process.stdout).text();
  if ((await process.exited) !== 0)
    throw new Error(`Dart ${args.join(" ")} failed`);
  if (args[0] === "run") {
    const data: Record<string, number[][]> = JSON.parse(output);
    const shapes = Object.fromEntries(
      Object.entries(data).map(([name, cubics]) => {
        const n = (value: number) => +(value * 100).toFixed(4);
        const path = `M${n(cubics[0][0])},${n(cubics[0][1])} ${cubics.map((c) => `C${c.slice(2).map(n).join(",")}`).join(" ")} Z`;
        const samples = cubics.flatMap((c) =>
          Array.from({ length: 24 }, (_, i) => {
            const t = i / 24;
            const a = 1 - t;
            return [
              a ** 3 * c[0] +
                3 * a * a * t * c[2] +
                3 * a * t * t * c[4] +
                t ** 3 * c[6],
              a ** 3 * c[1] +
                3 * a * a * t * c[3] +
                3 * a * t * t * c[5] +
                t ** 3 * c[7],
            ];
          }),
        );
        samples.push(samples[0]);
        const lengths = [0];
        for (let i = 1; i < samples.length; i++)
          lengths.push(
            lengths[i - 1] +
              Math.hypot(
                samples[i][0] - samples[i - 1][0],
                samples[i][1] - samples[i - 1][1],
              ),
          );
        let index = 1;
        const polygon = Array.from({ length: 128 }, (_, i) => {
          const distance = (lengths[lengths.length - 1] * i) / 128;
          while (index < lengths.length - 1 && lengths[index] < distance)
            index++;
          const t =
            (distance - lengths[index - 1]) /
            (lengths[index] - lengths[index - 1] || 1);
          return [0, 1].map((axis) =>
            n(
              samples[index - 1][axis] +
                (samples[index][axis] - samples[index - 1][axis]) * t,
            ),
          );
        });
        return [name, { path, polygon }];
      }),
    );
    await Bun.write(
      "apps/client/src/lib/expressive-shapes.json",
      `${JSON.stringify(Object.fromEntries(Object.entries(shapes).map(([name, shape]) => [name, { path: shape.path }])))}\n`,
    );
    const sequence = [
      "softBurst",
      "cookie9Sided",
      "pentagon",
      "pill",
      "sunny",
      "cookie4Sided",
      "oval",
      "softBurst",
    ];
    const frames = sequence
      .map(
        (name, i) =>
          `${((i / 7) * 100).toFixed(3)}% { clip-path: polygon(${shapes[name].polygon.map((p) => `${p[0]}% ${p[1]}%`).join(",")}); }`,
      )
      .join("\n");
    await Bun.write(
      "apps/client/src/styles/expressive-shapes.css",
      `[data-slot="loading-shape"] { clip-path: polygon(${shapes.softBurst.polygon.map((p) => `${p[0]}% ${p[1]}%`).join(",")}); }\n@keyframes m3-morph {\n${frames}\n}\n`,
    );
    console.log(`Exported ${names.length} source shapes and 7 morph stages.`);
  }
}
