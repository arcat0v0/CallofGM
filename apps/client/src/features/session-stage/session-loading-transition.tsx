import { type ReactNode, useEffect, useRef, useState } from "react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { cn } from "@/lib/utils";

type SessionLoadingVariant = "console" | "stage";
type TransitionPhase = "loading" | "exiting" | "done";

const DEFAULT_MIN_HOLD_MS = 260;
const DEFAULT_EXIT_MS = 360;
const DEFAULT_REVEAL_MS = 520;
const DEFAULT_PRELOAD_TIMEOUT_MS = 280;

function prefersReducedMotion(): boolean {
	if (
		typeof window === "undefined" ||
		typeof window.matchMedia !== "function"
	) {
		return false;
	}
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function preloadImage(
	url: string | null | undefined,
	timeoutMs: number,
): { promise: Promise<void>; cancel: () => void } {
	if (!url || timeoutMs <= 0 || typeof Image === "undefined") {
		return { promise: Promise.resolve(), cancel: () => undefined };
	}
	let settled = false;
	let timer: ReturnType<typeof setTimeout> | null = null;
	const image = new Image();
	let finish: () => void = () => undefined;

	const cleanup = () => {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
		image.onload = null;
		image.onerror = null;
	};

	const promise = new Promise<void>((resolve) => {
		finish = () => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			resolve();
		};
		image.onload = finish;
		image.onerror = finish;
		timer = setTimeout(finish, timeoutMs);
		image.src = url;
		if (image.complete) {
			finish();
		}
	});

	return {
		promise,
		cancel: () => {
			settled = true;
			cleanup();
		},
	};
}

type SessionLoadingCurtainProps = {
	variant?: SessionLoadingVariant;
	eyebrow?: string;
	title: string;
	description?: string;
	state?: "loading" | "exiting";
	className?: string;
};

function SessionLoadingCurtain({
	variant = "console",
	eyebrow,
	title,
	description,
	state = "loading",
	className,
}: SessionLoadingCurtainProps) {
	const exiting = state === "exiting";
	return (
		<div
			data-slot="session-loading-overlay"
			data-variant={variant}
			data-state={state}
			role={exiting ? undefined : "status"}
			aria-live={exiting ? undefined : "polite"}
			aria-busy={exiting ? undefined : true}
			aria-hidden={exiting || undefined}
			className={cn(
				"bg-background absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden px-6",
				exiting && "pointer-events-none",
				className,
			)}
		>
			<div
				aria-hidden="true"
				data-slot="session-loading-ambient"
				data-ambient-role="primary"
				className="bg-md-primary/10 pointer-events-none absolute -top-28 -left-28 size-96 rounded-full blur-3xl"
			/>
			<div
				aria-hidden="true"
				data-slot="session-loading-ambient"
				data-ambient-role="secondary"
				className="bg-md-tertiary/10 pointer-events-none absolute -right-32 -bottom-32 size-105 rounded-full blur-3xl"
			/>
			<div
				data-slot="session-loading-card"
				className="relative z-10 flex flex-col items-center text-center"
			>
				<div
					aria-hidden="true"
					className="relative mb-6 grid size-24 place-items-center"
				>
					<span className="bg-md-primary/15 pointer-events-none absolute inset-1 rounded-full blur-xl" />
					<span
						data-slot="session-loading-pulse"
						className="border-md-primary/30 pointer-events-none absolute inset-0 rounded-full border"
					/>
					<span className="bg-md-surface-container-low/90 border-md-outline-variant/45 shadow-overlay grid size-22 place-items-center rounded-full border">
						<LoadingIndicator
							contained
							label=""
							role="presentation"
							aria-hidden="true"
							className="size-15 [&>span]:size-10"
						/>
					</span>
				</div>
				{eyebrow ? (
					<span className="bg-md-surface-container-high/85 text-md-on-surface-variant border-md-outline-variant/40 mb-3 rounded-full border px-3.5 py-1 text-label-medium">
						{eyebrow}
					</span>
				) : null}
				<h1
					className={cn(
						"text-md-on-surface",
						variant === "stage"
							? "font-serif text-headline-small-emph"
							: "font-sans text-title-large-emph",
					)}
				>
					{title}
				</h1>
				{description ? (
					<p className="text-md-on-surface-variant mt-1.5 max-w-xs text-body-medium">
						{description}
					</p>
				) : null}
			</div>
		</div>
	);
}

type SessionLoadingTransitionProps = {
	ready: boolean;
	suppressed?: boolean;
	variant?: SessionLoadingVariant;
	eyebrow?: string;
	title: string;
	description?: string;
	preloadImageUrl?: string | null;
	fallbackOverlay?: ReactNode;
	minHoldMs?: number;
	exitMs?: number;
	preloadTimeoutMs?: number;
	children: ReactNode;
};

function SessionLoadingTransition({
	ready,
	suppressed = false,
	variant = "console",
	eyebrow,
	title,
	description,
	preloadImageUrl,
	fallbackOverlay,
	minHoldMs = DEFAULT_MIN_HOLD_MS,
	exitMs = DEFAULT_EXIT_MS,
	preloadTimeoutMs = DEFAULT_PRELOAD_TIMEOUT_MS,
	children,
}: SessionLoadingTransitionProps) {
	const [phase, setPhase] = useState<TransitionPhase>(() =>
		ready ? "done" : "loading",
	);
	const [revealing, setRevealing] = useState(false);
	const enteredAtRef = useRef(Date.now());

	useEffect(() => {
		if (!ready) {
			setPhase((current) => {
				if (current !== "loading") {
					enteredAtRef.current = Date.now();
				}
				return "loading";
			});
			setRevealing(false);
		}
	}, [ready]);

	useEffect(() => {
		if (!ready || phase !== "loading") {
			return;
		}
		if (suppressed) {
			setPhase("done");
			setRevealing(false);
			return;
		}
		let cancelled = false;
		let holdTimer: ReturnType<typeof setTimeout> | null = null;
		const reduced = prefersReducedMotion();
		const preload = preloadImage(
			preloadImageUrl,
			reduced ? 0 : preloadTimeoutMs,
		);

		void preload.promise.then(() => {
			if (cancelled) {
				return;
			}
			const finishLoading = () => {
				if (cancelled) {
					return;
				}
				if (reduced || exitMs <= 0) {
					setRevealing(false);
					setPhase("done");
					return;
				}
				setRevealing(true);
				setPhase("exiting");
			};

			const remaining = reduced
				? 0
				: Math.max(0, minHoldMs - (Date.now() - enteredAtRef.current));
			if (remaining > 0) {
				holdTimer = setTimeout(finishLoading, remaining);
			} else {
				finishLoading();
			}
		});

		return () => {
			cancelled = true;
			preload.cancel();
			if (holdTimer !== null) {
				clearTimeout(holdTimer);
			}
		};
	}, [
		exitMs,
		minHoldMs,
		phase,
		preloadImageUrl,
		preloadTimeoutMs,
		ready,
		suppressed,
	]);

	useEffect(() => {
		if (phase !== "exiting") {
			return;
		}
		const timer = setTimeout(() => {
			setPhase("done");
		}, exitMs);
		return () => clearTimeout(timer);
	}, [exitMs, phase]);

	useEffect(() => {
		if (!revealing) {
			return;
		}
		const timer = setTimeout(
			() => {
				setRevealing(false);
			},
			Math.max(DEFAULT_REVEAL_MS, exitMs),
		);
		return () => clearTimeout(timer);
	}, [exitMs, revealing]);

	const showChildren = ready && phase !== "loading";
	const showCurtain = !suppressed && phase !== "done";

	return (
		<>
			{showChildren ? (
				<div
					data-slot="session-stage-reveal"
					data-variant={variant}
					data-reveal={revealing ? "entering" : undefined}
					className="relative h-full w-full"
				>
					{children}
				</div>
			) : (
				fallbackOverlay
			)}
			{showCurtain ? (
				<SessionLoadingCurtain
					variant={variant}
					eyebrow={eyebrow}
					title={title}
					description={description}
					state={phase === "exiting" ? "exiting" : "loading"}
				/>
			) : null}
		</>
	);
}

export { SessionLoadingCurtain, SessionLoadingTransition };
