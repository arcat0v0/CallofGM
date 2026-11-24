/**
 * Rebuilds the DeepFilterNet3 voice assets shipped with the client.
 *
 *   bun run native/deepfilter-wasm/build.ts
 *
 * Needs a Rust toolchain with the `wasm32-unknown-unknown` target
 * (`rustup target add wasm32-unknown-unknown`). Writes:
 *   apps/client/src/features/voice/vendor/deepfilternet3/deepfilternet3-runtime.bin
 *     gzip-compressed WebAssembly (SIMD128), no imports
 *   apps/client/src/features/voice/vendor/deepfilternet3/deepfilternet3-model.bin
 *     upstream models/DeepFilterNet3_onnx.tar.gz, byte for byte
 * plus the upstream license files. The `.bin` extension keeps static hosts
 * from adding `Content-Encoding: gzip` and decoding the payload in transit.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const crateDir = import.meta.dirname;
const root = path.resolve(crateDir, "../..");
const outDir = path.join(
	root,
	"apps/client/src/features/voice/vendor/deepfilternet3",
);
const targetDir = process.env.CARGO_TARGET_DIR ?? path.join(crateDir, "target");

function run(command: string[], env: Record<string, string> = {}): string {
	const result = Bun.spawnSync(command, {
		cwd: crateDir,
		env: { ...process.env, ...env },
		stdout: "pipe",
		stderr: "inherit",
	});
	if (result.exitCode !== 0) {
		throw new Error(`${command.join(" ")} failed (${result.exitCode})`);
	}
	return result.stdout.toString();
}

run(
	[
		"cargo",
		"build",
		"--locked",
		"--release",
		"--target",
		"wasm32-unknown-unknown",
	],
	{ RUSTFLAGS: "-C target-feature=+simd128", CARGO_TARGET_DIR: targetDir },
);

const metadata = JSON.parse(
	run(["cargo", "metadata", "--locked", "--format-version", "1"]),
) as { packages: Array<{ name: string; manifest_path: string }> };
const upstream = metadata.packages.find((pkg) => pkg.name === "deep_filter");
if (!upstream) throw new Error("deep_filter package not found");
const upstreamRoot = path.resolve(path.dirname(upstream.manifest_path), "..");

const wasm = readFileSync(
	path.join(
		targetDir,
		"wasm32-unknown-unknown/release/cogm_deepfilter_wasm.wasm",
	),
);
const module = new WebAssembly.Module(wasm);
if (WebAssembly.Module.imports(module).length > 0) {
	throw new Error("DeepFilterNet3 runtime must not import anything");
}

mkdirSync(outDir, { recursive: true });
writeFileSync(
	path.join(outDir, "deepfilternet3-runtime.bin"),
	gzipSync(wasm, { level: 9 }),
);
copyFileSync(
	path.join(upstreamRoot, "models/DeepFilterNet3_onnx.tar.gz"),
	path.join(outDir, "deepfilternet3-model.bin"),
);
for (const license of ["LICENSE-MIT", "LICENSE-APACHE"]) {
	copyFileSync(path.join(upstreamRoot, license), path.join(outDir, license));
}

for (const name of ["deepfilternet3-runtime.bin", "deepfilternet3-model.bin"]) {
	const bytes = readFileSync(path.join(outDir, name));
	const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
	console.log(`${name}  ${bytes.length} bytes  sha256 ${sha256}`);
}
