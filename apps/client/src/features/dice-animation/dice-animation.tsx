import { useEffect, useRef, useState } from "react";
import {
	AmbientLight,
	Clock,
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
	DICE_ANIMATION_DURATION_MS,
	type DiceAnimationDie,
	type DiceAnimationRequest,
} from "./model";

type OrientationMap = Record<string, readonly [number, number, number, number]>;

type DiceAnimationLayerProps = {
	request: DiceAnimationRequest | null;
	onComplete?: (id: string) => void;
};

const TUMBLE_START_MS = 700;
const SETTLE_MS = 450;

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

function fitModel(
	model: Object3D,
	die: DiceAnimationDie,
	index: number,
	total: number,
) {
	const offset = index - (total - 1) / 2;
	model.position.set(offset * 2.1, 0, 0);
	model.scale.setScalar(1 / Math.max(total, 2));
	model.userData.dieValue = die.value;
}

function disposeObject(object: Object3D) {
	object.traverse((child) => {
		if (!("geometry" in child) && !("material" in child)) return;
		const geometry = (child as { geometry?: { dispose?: () => void } })
			.geometry;
		const material = (child as { material?: unknown }).material;
		geometry?.dispose?.();
		if (Array.isArray(material)) {
			for (const entry of material) {
				(entry as { dispose?: () => void } | undefined)?.dispose?.();
			}
		} else {
			(material as { dispose?: () => void } | undefined)?.dispose?.();
		}
	});
}

function DiceAnimationLayer({ request, onComplete }: DiceAnimationLayerProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const [label, setLabel] = useState("");

	useEffect(() => {
		const host = hostRef.current;
		if (!host || !request) return;
		const animationId = request.id;
		const dice = buildDiceAnimationDice(request);
		if (dice.length === 0) {
			onComplete?.(animationId);
			return;
		}
		setLabel(request.label);

		const reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		const scene = new Scene();
		const camera = new PerspectiveCamera(35, 1, 0.1, 100);
		camera.position.set(0, 0.4, 8);
		camera.lookAt(new Vector3(0, 0, 0));
		scene.add(new AmbientLight(0xffffff, 2.2));
		const keyLight = new DirectionalLight(0xffffff, 3.4);
		keyLight.position.set(3, 5, 6);
		scene.add(keyLight);

		const renderer = new WebGLRenderer({ alpha: true, antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setClearAlpha(0);
		host.replaceChildren(renderer.domElement);

		const group = new Group();
		scene.add(group);
		const loader = new GLTFLoader();
		const orientations = new Map<string, Promise<OrientationMap>>();
		const finishAt = performance.now() + DICE_ANIMATION_DURATION_MS;
		let disposed = false;
		let frame = 0;
		let completionTimer: ReturnType<typeof setTimeout> | null = null;
		const clock = new Clock();

		function resize() {
			if (!host) return;
			const width = Math.max(host.clientWidth, 1);
			const height = Math.max(host.clientHeight, 1);
			renderer.setSize(width, height, false);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
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

		void Promise.all(
			dice.map(async (die, index) => {
				const gltf = await loader.loadAsync(die.asset);
				if (disposed) return;
				const model = gltf.scene;
				fitModel(model, die, index, dice.length);
				group.add(model);
				let map: OrientationMap | undefined;
				if (die.orientationHint) {
					let pending = orientations.get(die.orientationHint);
					if (!pending) {
						pending = fetch(die.orientationHint)
							.then((response) => response.json())
							.catch(() => ({})) as Promise<OrientationMap>;
						orientations.set(die.orientationHint, pending);
					}
					map = await pending;
				}
				const from = randomQuaternion();
				const to = targetQuaternion(die, map);
				model.quaternion.copy(from);
				model.userData.start = from;
				model.userData.target = to;
			}),
		).catch(() => undefined);

		function animate() {
			if (disposed) return;
			resize();
			const elapsed = Math.min(
				clock.getElapsedTime() * 1000,
				DICE_ANIMATION_DURATION_MS,
			);
			for (const child of group.children) {
				const from = child.userData.start as Quaternion | undefined;
				const to = child.userData.target as Quaternion | undefined;
				if (!from || !to) continue;
				if (reducedMotion || elapsed >= TUMBLE_START_MS) {
					const settleProgress = reducedMotion
						? 1
						: Math.min((elapsed - TUMBLE_START_MS) / SETTLE_MS, 1);
					child.quaternion.slerpQuaternions(
						from,
						to,
						easeOutCubic(settleProgress),
					);
				} else {
					const phase = elapsed / 180;
					child.rotation.set(
						Math.sin(phase) * Math.PI,
						Math.cos(phase * 0.8) * Math.PI,
						Math.sin(phase * 1.3) * Math.PI,
					);
				}
			}
			renderer.render(scene, camera);
			if (performance.now() < finishAt) {
				frame = requestAnimationFrame(animate);
			} else {
				onComplete?.(animationId);
			}
		}

		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(host);
		frame = requestAnimationFrame(animate);
		completionTimer = setTimeout(
			() => onComplete?.(animationId),
			DICE_ANIMATION_DURATION_MS + 120,
		);

		return () => {
			disposed = true;
			cancelAnimationFrame(frame);
			if (completionTimer) clearTimeout(completionTimer);
			observer.disconnect();
			for (const child of group.children) disposeObject(child);
			renderer.dispose();
			renderer.domElement.remove();
			setLabel("");
		};
	}, [request, onComplete]);

	return (
		<div
			className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
			aria-hidden="true"
		>
			<div className="stage-glass shadow-overlay relative flex h-[min(46vh,360px)] w-[min(72vw,640px)] flex-col overflow-hidden rounded-xl">
				<div ref={hostRef} className="min-h-0 flex-1" role="presentation" />
				<p className="text-md-on-surface bg-md-surface-container-low/80 py-2 text-center text-label-large-emph">
					{label || t("dice.animationRolling")}
				</p>
			</div>
		</div>
	);
}

export type { DiceAnimationLayerProps };
export { DiceAnimationLayer };
