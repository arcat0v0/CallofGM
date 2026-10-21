import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const lock = await Bun.file(
  new URL("../docs/design-system/upstream.lock.json", import.meta.url),
).json();
const destination = resolve(process.argv[2] ?? "/tmp/cogm-m3-sources");
await mkdir(destination, { recursive: true });
for (const source of lock.packages) {
  const response = await fetch(source.archive);
  if (!response.ok) throw new Error(`${source.name}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) {
    throw new Error(`${source.name}: SHA-256 mismatch`);
  }
  const archive = join(destination, `${source.name}.tar.gz`);
  const directory = join(destination, source.name);
  await Bun.write(archive, bytes);
  await mkdir(directory, { recursive: true });
  const result = Bun.spawn(["tar", "-xzf", archive, "-C", directory]);
  if ((await result.exited) !== 0)
    throw new Error(`${source.name}: extraction failed`);
  console.log(`${source.name}@${source.version}: verified → ${directory}`);
}
