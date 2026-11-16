import { useEffect, useRef } from "react";
import {
	AmbientLight,
	Box3,
	DirectionalLight,
	Group,
	type Object3D,
	PerspectiveCamera,
	Quaternion,
	Scene,
	Vector3,
	WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { t } from "@/i18n";
import {
	buildDiceAnimationDice,
	computeDiceGridLayout,
	DICE_ANIMATION_DURATION_MS,
	DICE_CAMERA_DISTANCE,
	DICE_CAMERA_FOV_DEG,
	DICE_REDUCED_MOTION_DURATION_MS,
	DICE_SETTLE_MS,
	DICE_TUMBLE_MS,
	type DiceAnimationDie,
	type DiceAnimationRequest,
	PRELOAD_DICE_ASSETS,
	PRELOAD_ORIENTATION_ASSETS,
} from "./model";

type OrientationMap = Record<string, readonly [number, number, number, number]>;

type CachedModelTemplate = {
	scene: Object3D;
	center: Vector3;
	diameter: number;
};

type DiceAnimationLayerProps = {
	request: DiceAnimationRequest | null;
	onComplete?: (id: string) => void;
};

const LOAD_SAFETY_TIMEOUT_MS = 15_000;
const CAMERA_DIRECTION = new Vector3(0, 0.45, 1).normalize();
const sharedLoader = new GLTFLoader();
const modelTemplateCache = new Map<string, Promise<CachedModelTemplate>>();
const orientationCache = new Map<string, Promise<OrientationMap>>();
let preloaded = false;

function computeBoundingSphereDiameter(
	scene: Object3D,
	center: Vector3,
): number {
	const vertex = new Vector3();
	let maxRadius = 0;
	scene.updateMatrixWorld(true);
	scene.traverse((child) => {
		const geometry = (
			child as {
				geometry?: {
					getAttribute?: (name: string) => {
						count: number;
						getX: (index: number) => number;
						getY: (index: number) => number;
						getZ: (index: number) => number;
					};
				};
			}
		).geometry;
		const pos = geometry?.getAttribute?.("position");
		if (!pos) return;
		for (let index = 0; index < pos.count; index += 1) {
			vertex
				.set(pos.getX(index), pos.getY(index), pos.getZ(index))
				.applyMatrix4(child.matrixWorld);
			const radius = vertex.distanceTo(center);
			if (radius > maxRadius) maxRadius = radius;
		}
	});
	if (maxRadius > 0) {
		return maxRadius * 2;
	}
	const box = new Box3().setFromObject(scene);
	const size = new Vector3();
	box.getSize(size);
	return Math.max(size.x, size.y, size.z, 0.001);
}

function loadModelTemplate(asset: string): Promise<CachedModelTemplate> {
	const cached = modelTemplateCache.get(asset);
	if (cached) return cached;
	const pending = sharedLoader
		.loadAsync(asset)
		.then((gltf) => {
			const box = new Box3().setFromObject(gltf.scene);
			const center = new Vector3();
			box.getCenter(center);
			const diameter = computeBoundingSphereDiameter(gltf.scene, center);
			return { scene: gltf.scene, center, diameter };
		})
		.catch((error) => {
			modelTemplateCache.delete(asset);
			throw error;
		});
	modelTemplateCache.set(asset, pending);
	return pending;
}

function loadOrientationMap(url: string): Promise<OrientationMap> {
	const cached = orientationCache.get(url);
	if (cached) return cached;
	const pending = fetch(url)
		.then((response) => {
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			return response.json() as Promise<OrientationMap>;
		})
		.catch(() => {
			orientationCache.delete(url);
			return {} as OrientationMap;
		});
	orientationCache.set(url, pending);
	return pending;
}

function preloadDiceAssets(): void {
	if (preloaded || typeof window === "undefined") return;
	if (
		typeof window.location?.origin !== "string" ||
		window.location.origin === "null"
	) {
		return;
	}
	preloaded = true;
	for (const asset of PRELOAD_DICE_ASSETS) {
		void loadModelTemplate(asset).catch(() => undefined);
	}
	for (const url of PRELOAD_ORIENTATION_ASSETS) {
		void loadOrientationMap(url).catch(() => undefined);
	}
}

function randomQuaternion(): Quaternion {
	return new Quaternion(
		Math.random() * 2 - 1,
		Math.random() * 2 - 1,
		Math.random() * 2 - 1,
		Math.random() * 2 - 1,
	).normalize();
}

function easeOutCubic(progress: number): number {
	return 1 - (1 - progress) ** 3;
}

function instantiateNormalizedDie(
	template: CachedModelTemplate,
	die: DiceAnimationDie,
	index: number,
): Group {
	const wrapper = new Group();
	const normalized = new Group();
	const clone = template.scene.clone(true);
	clone.position.copy(template.center).multiplyScalar(-1);
	normalized.scale.setScalar(1 / template.diameter);
	normalized.add(clone);
	wrapper.add(normalized);
	wrapper.userData.dieIndex = index;
	wrapper.userData.dieValue = die.value;
	return wrapper;
}

function targetQuaternion(
	die: DiceAnimationDie,
	map: OrientationMap | undefined,
): Quaternion {
	const value = map?.[die.value];
	return value
		? new Quaternion(value[0], value[1], value[2], value[3]).normalize()
		: randomQuaternion();
}

function DiceAnimationStage({
	request,
	onComplete,
}: {
	request: DiceAnimationRequest;
	onComplete?: (id: string) => void;
}) {
	const hostRef = useRef<HTMLDivElement>(null);
	const onCompleteRef = useRef(onComplete);
	onCompleteRef.current = onComplete;

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const animationId = request.id;
		const dice = buildDiceAnimationDice(request);
		if (dice.length === 0) {
			onCompleteRef.current?.(animationId);
			return;
		}

		const reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		const activeDuration = reducedMotion
			? DICE_REDUCED_MOTION_DURATION_MS
			: DICE_ANIMATION_DURATION_MS;

		const scene = new Scene();
		const camera = new PerspectiveCamera(DICE_CAMERA_FOV_DEG, 1, 0.1, 100);
		camera.position.copy(CAMERA_DIRECTION).multiplyScalar(DICE_CAMERA_DISTANCE);
		camera.lookAt(new Vector3(0, 0, 0));
		scene.add(new AmbientLight(0xffffff, 2.2));
		const keyLight = new DirectionalLight(0xffffff, 3.0);
		keyLight.position.set(3, 5, 6);
		scene.add(keyLight);
		const fillLight = new DirectionalLight(0xeef4ff, 1.4);
		fillLight.position.set(-3, 2, 4);
		scene.add(fillLight);

		let renderer: WebGLRenderer;
		try {
			renderer = new WebGLRenderer({ alpha: true, antialias: true });
		} catch {
			onCompleteRef.current?.(animationId);
			return;
		}
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setClearAlpha(0);
		host.replaceChildren(renderer.domElement);

		const group = new Group();
		scene.add(group);

		let disposed = false;
		let completed = false;
		let frame = 0;
		let animationStartedAt: number | null = null;
		let finishAt: number | null = null;
		let completionTimer: ReturnType<typeof setTimeout> | null = null;
		let loadSafetyTimer: ReturnType<typeof setTimeout> | null = null;

		function finish() {
			if (disposed || completed) return;
			completed = true;
			onCompleteRef.current?.(animationId);
		}

		function layoutDice(width: number, height: number) {
			if (group.children.length === 0) return;
			const layout = computeDiceGridLayout(
				dice.length,
				width,
				height,
				DICE_CAMERA_FOV_DEG,
				DICE_CAMERA_DISTANCE,
			);
			for (const child of group.children) {
				const idx = child.userData.dieIndex as number | undefined;
				if (idx === undefined) continue;
				const pos = layout.positions[idx];
				if (!pos) continue;
				child.position.set(pos.x, pos.y, 0);
				child.scale.setScalar(layout.dieWorldSize);
			}
		}

		function resize() {
			if (!host) return;
			const width = Math.max(host.clientWidth, 1);
			const height = Math.max(host.clientHeight, 1);
			renderer.setSize(width, height, false);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			layoutDice(width, height);
		}

		loadSafetyTimer = setTimeout(finish, LOAD_SAFETY_TIMEOUT_MS);

		void Promise.all(
			dice.map(async (die, index) => {
				const [template, map] = await Promise.all([
					loadModelTemplate(die.asset),
					die.orientationHint
						? loadOrientationMap(die.orientationHint)
						: Promise.resolve(undefined),
				]);
				if (disposed) return null;
				const model = instantiateNormalizedDie(template, die, index);
				const from = randomQuaternion();
				const to = targetQuaternion(die, map);
				model.quaternion.copy(reducedMotion ? to : from);
				model.userData.start = from;
				model.userData.target = to;
				return model;
			}),
		)
			.then((models) => {
				if (loadSafetyTimer) {
					clearTimeout(loadSafetyTimer);
					loadSafetyTimer = null;
				}
				if (disposed) return;
				for (const model of models) {
					if (model) group.add(model);
				}
				resize();
				animationStartedAt = performance.now();
				finishAt = animationStartedAt + activeDuration;
				completionTimer = setTimeout(finish, activeDuration + 120);
			})
			.catch(() => {
				if (loadSafetyTimer) {
					clearTimeout(loadSafetyTimer);
					loadSafetyTimer = null;
				}
				finish();
			});

		function animate() {
			if (disposed) return;
			const now = performance.now();
			if (animationStartedAt !== null) {
				const elapsed = Math.min(now - animationStartedAt, activeDuration);
				for (const child of group.children) {
					const to = child.userData.target as Quaternion | undefined;
					if (!to) continue;
					if (reducedMotion) {
						child.quaternion.copy(to);
						continue;
					}
					if (elapsed >= DICE_TUMBLE_MS) {
						let settleStart = child.userData.settleStart as
							| Quaternion
							| undefined;
						if (!settleStart) {
							settleStart = child.quaternion.clone();
							child.userData.settleStart = settleStart;
						}
						const settleProgress = Math.min(
							(elapsed - DICE_TUMBLE_MS) / DICE_SETTLE_MS,
							1,
						);
						child.quaternion.slerpQuaternions(
							settleStart,
							to,
							easeOutCubic(settleProgress),
						);
					} else {
						const idx = (child.userData.dieIndex as number | undefined) ?? 0;
						const spinX = 1.0 + (idx % 3) * 0.25;
						const spinY = 0.8 + ((idx + 1) % 3) * 0.22;
						const spinZ = 1.3 + ((idx + 2) % 3) * 0.19;
						const phase = elapsed / 180 + idx * 1.37;
						child.rotation.set(
							Math.sin(phase * spinX) * Math.PI,
							Math.cos(phase * spinY) * Math.PI,
							Math.sin(phase * spinZ) * Math.PI,
						);
					}
				}
			}
			renderer.render(scene, camera);
			if (finishAt === null || now < finishAt) {
				frame = requestAnimationFrame(animate);
			} else {
				finish();
			}
		}

		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(host);
		frame = requestAnimationFrame(animate);

		return () => {
			disposed = true;
			cancelAnimationFrame(frame);
			if (completionTimer) clearTimeout(completionTimer);
			if (loadSafetyTimer) clearTimeout(loadSafetyTimer);
			observer.disconnect();
			group.clear();
			renderer.dispose();
			renderer.forceContextLoss();
			renderer.domElement.remove();
		};
	}, [request]);

	const label = request.label || t("dice.animationRolling");

	return (
		<div
			className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
			aria-hidden="true"
		>
			<div className="stage-glass shadow-overlay relative flex h-[min(46vh,360px)] w-[min(90vw,640px)] flex-col overflow-hidden rounded-xl">
				<div ref={hostRef} className="min-h-0 flex-1" role="presentation" />
				<p className="text-md-on-surface bg-md-surface-container-low/80 py-2 text-center text-label-large-emph">
					{label}
				</p>
			</div>
		</div>
	);
}

function DiceAnimationLayer({ request, onComplete }: DiceAnimationLayerProps) {
	if (!request) return null;
	return (
		<DiceAnimationStage
			key={request.id}
			request={request}
			onComplete={onComplete}
		/>
	);
}

export type { DiceAnimationLayerProps };
export { DiceAnimationLayer, preloadDiceAssets };
