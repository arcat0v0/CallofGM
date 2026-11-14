import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const clientDir = path.join(root, "apps/client");
const publicDir = path.join(clientDir, "public");
const outputDir = path.join(publicDir, "dice/previews");
const serverPort = 15637;
const debugPort = 19300 + (process.pid % 500);
const skins = ["olive", "bone"] as const;

type CdpResponse = {
	id?: number;
	method?: string;
	params?: Record<string, unknown>;
	result?: Record<string, unknown>;
	error?: { message?: string };
};

function contentTypeOf(filePath: string): string {
	if (filePath.endsWith(".gltf") || filePath.endsWith(".json"))
		return "application/json";
	if (filePath.endsWith(".js") || filePath.endsWith(".mjs"))
		return "text/javascript";
	if (filePath.endsWith(".svg")) return "image/svg+xml";
	return "application/octet-stream";
}

function previewPage(skin: string): string {
	return `<!doctype html>
<html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<style>html,body{margin:0;width:100%;height:100%;background:#1c1c1c;overflow:hidden}#c{width:100%;height:100%;display:block}</style>
</head><body><canvas id="c" width="960" height="540"></canvas><script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
try {
  const skin=${JSON.stringify(skin)};
  const canvas=document.getElementById('c');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(1); renderer.setSize(960,540,false); renderer.setClearColor(0x1c1c1c,1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(35,960/540,.1,100);
  const direction=new THREE.Vector3(0,.45,1).normalize();
  camera.position.copy(direction).multiplyScalar(5.5); camera.lookAt(0,0,0);
  scene.add(new THREE.AmbientLight(0xffffff,2.2));
  const key=new THREE.DirectionalLight(0xffffff,3); key.position.set(3,5,6); scene.add(key);
  const fill=new THREE.DirectionalLight(0xeef4ff,1.4); fill.position.set(-3,2,4); scene.add(fill);
  const loader=new GLTFLoader();
  const [gltf,orientations]=await Promise.all([
    loader.loadAsync('/dice/'+skin+'/d20.gltf'),
    fetch('/dice/orientations/d20.json').then(r=>r.json()),
  ]);
  const object=gltf.scene;
  const bounds=new THREE.Box3().setFromObject(object);
  const center=new THREE.Vector3(); bounds.getCenter(center);
  object.position.copy(center).multiplyScalar(-1);
  const normal=new THREE.Group(); normal.add(object);
  const group=new THREE.Group(); group.add(normal);
  group.quaternion.fromArray(orientations['20']).normalize();
  const vertex=new THREE.Vector3(); let maxRadius=0;
  object.updateMatrixWorld(true);
  object.traverse(child=>{
    const position=child.geometry?.getAttribute?.('position');
    if(!position)return;
    for(let index=0;index<position.count;index++){
      vertex.set(position.getX(index),position.getY(index),position.getZ(index)).applyMatrix4(child.matrixWorld);
      maxRadius=Math.max(maxRadius,vertex.distanceTo(center));
    }
  });
  normal.scale.setScalar(1/(maxRadius*2)); group.scale.setScalar(2.35);
  scene.add(group); renderer.render(scene,camera);
  window.__preview=canvas.toDataURL('image/webp',.92);
  document.title='ready';
} catch(error) {
  window.__previewError=String(error?.stack ?? error);
  document.title='error';
}
</script></body></html>`;
}

function startServer(): Bun.Server<undefined> {
	return Bun.serve({
		port: serverPort,
		hostname: "127.0.0.1",
		async fetch(request) {
			const url = new URL(request.url);
			const pathname = decodeURIComponent(url.pathname);
			if (pathname === "/render-preview.html") {
				const skin = url.searchParams.get("skin") ?? "olive";
				return new Response(previewPage(skin), {
					headers: { "content-type": "text/html; charset=utf-8" },
				});
			}
			const baseDir = pathname.startsWith("/node_modules/")
				? clientDir
				: pathname.startsWith("/dice/")
					? publicDir
					: null;
			if (!baseDir) return new Response("Not found", { status: 404 });
			const relative = pathname.replace(/^\/+/, "");
			const filePath = path.resolve(baseDir, relative);
			if (!filePath.startsWith(`${baseDir}${path.sep}`)) {
				return new Response("Not found", { status: 404 });
			}
			const file = Bun.file(filePath);
			if (!(await file.exists()))
				return new Response("Not found", { status: 404 });
			return new Response(file, {
				headers: { "content-type": contentTypeOf(filePath) },
			});
		},
	});
}

async function pageTarget(): Promise<{ webSocketDebuggerUrl: string }> {
	for (let attempt = 0; attempt < 80; attempt += 1) {
		try {
			const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
			const targets = (await response.json()) as Array<{
				type?: string;
				webSocketDebuggerUrl?: string;
			}>;
			const page = targets.find(
				(target) => target.type === "page" && target.webSocketDebuggerUrl,
			);
			if (page?.webSocketDebuggerUrl) {
				return { webSocketDebuggerUrl: page.webSocketDebuggerUrl };
			}
		} catch {
			// The browser has not opened the debugging endpoint yet.
		}
		await Bun.sleep(100);
	}
	throw new Error("Chromium debugging endpoint did not become ready");
}

function connectCdp(webSocketDebuggerUrl: string) {
	const socket = new WebSocket(webSocketDebuggerUrl);
	const pending = new Map<
		number,
		{
			resolve: (value: Record<string, unknown>) => void;
			reject: (error: Error) => void;
		}
	>();
	const diagnostics: string[] = [];
	let nextId = 1;

	socket.addEventListener("message", (event) => {
		const message = JSON.parse(String(event.data)) as CdpResponse;
		if (message.id !== undefined) {
			const request = pending.get(message.id);
			if (!request) return;
			pending.delete(message.id);
			if (message.error) {
				request.reject(new Error(message.error.message ?? "CDP error"));
			} else {
				request.resolve(message.result ?? {});
			}
			return;
		}
		if (message.method === "Runtime.exceptionThrown") {
			diagnostics.push(JSON.stringify(message.params));
		}
		if (message.method === "Log.entryAdded") {
			const entry = message.params?.entry as { level?: string; text?: string };
			if (entry?.level === "error" && entry.text) {
				diagnostics.push(entry.text);
			}
		}
	});

	async function open(): Promise<void> {
		if (socket.readyState === WebSocket.OPEN) return;
		await new Promise<void>((resolve, reject) => {
			socket.addEventListener("open", () => resolve(), { once: true });
			socket.addEventListener(
				"error",
				() => reject(new Error("CDP WebSocket failed")),
				{ once: true },
			);
		});
	}

	async function send(
		method: string,
		params: Record<string, unknown> = {},
	): Promise<Record<string, unknown>> {
		const id = nextId;
		nextId += 1;
		const response = new Promise<Record<string, unknown>>((resolve, reject) => {
			pending.set(id, { resolve, reject });
		});
		socket.send(JSON.stringify({ id, method, params }));
		return response;
	}

	return { socket, pending, diagnostics, open, send };
}

async function renderSkin(
	cdp: ReturnType<typeof connectCdp>,
	skin: string,
): Promise<Buffer> {
	await cdp.send("Page.navigate", {
		url: `http://127.0.0.1:${serverPort}/render-preview.html?skin=${skin}`,
	});
	for (let attempt = 0; attempt < 120; attempt += 1) {
		const result = await cdp.send("Runtime.evaluate", {
			expression:
				"window.__preview || (window.__previewError ? { error: window.__previewError } : null)",
			returnByValue: true,
		});
		const value = result.result as { value?: unknown } | undefined;
		const preview = value?.value as
			| string
			| { error?: string }
			| null
			| undefined;
		if (typeof preview === "string" && preview.startsWith("data:image/webp")) {
			const base64 = preview.slice(preview.indexOf(",") + 1);
			return Buffer.from(base64, "base64");
		}
		if (preview && typeof preview === "object" && preview.error) {
			throw new Error(`Preview for ${skin} failed: ${preview.error}`);
		}
		await Bun.sleep(250);
	}
	throw new Error(
		`Preview for ${skin} timed out${cdp.diagnostics.length > 0 ? `: ${cdp.diagnostics.slice(-3).join(" | ")}` : ""}`,
	);
}

await mkdir(outputDir, { recursive: true });
const profile = `/tmp/cogm-dice-preview-${process.pid}`;
const chromium = Bun.spawn(
	[
		"chromium",
		"--headless=new",
		"--no-sandbox",
		"--disable-dev-shm-usage",
		"--disable-gpu-sandbox",
		"--ignore-gpu-blocklist",
		"--enable-webgl",
		"--enable-unsafe-swiftshader",
		"--use-gl=angle",
		"--use-angle=swiftshader",
		"--disable-background-timer-throttling",
		"--disable-renderer-backgrounding",
		`--user-data-dir=${profile}`,
		`--remote-debugging-port=${debugPort}`,
		"--window-size=960,540",
		"about:blank",
	],
	{ stdout: "ignore", stderr: "ignore" },
);
const server = startServer();
let cdp: ReturnType<typeof connectCdp> | null = null;
try {
	const target = await pageTarget();
	cdp = connectCdp(target.webSocketDebuggerUrl);
	await cdp.open();
	await cdp.send("Page.enable");
	await cdp.send("Runtime.enable");
	await cdp.send("Log.enable");
	for (const skin of skins) {
		const bytes = await renderSkin(cdp, skin);
		if (bytes.byteLength < 1000) {
			throw new Error(`Preview for ${skin} is unexpectedly small`);
		}
		await writeFile(path.join(outputDir, `${skin}-d20.webp`), bytes);
		console.log(`rendered ${skin}-d20.webp (${bytes.byteLength} bytes)`);
	}
} finally {
	cdp?.socket.close();
	for (const request of cdp?.pending.values() ?? []) {
		request.reject(new Error("Renderer stopped"));
	}
	server.stop(true);
	process.kill(chromium.pid, "SIGTERM");
}
