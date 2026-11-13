import { Clapperboard } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

export function SceneBackdrop({
	src,
	alt,
	className,
	imageClassName,
}: {
	src?: string;
	alt: string;
	className?: string;
	imageClassName?: string;
}) {
	const [front, setFront] = useState(src);
	const [back, setBack] = useState<string | undefined>(undefined);
	const [frontVisible, setFrontVisible] = useState(true);
	const frontRef = useRef(src);

	useEffect(() => {
		const previous = frontRef.current;
		if (src === previous) {
			setFrontVisible(true);
			return;
		}
		frontRef.current = src;
		setBack(src ? previous : undefined);
		setFront(src);
		setFrontVisible(false);
		const frame = window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => setFrontVisible(true));
		});
		const timer = src ? window.setTimeout(() => setBack(undefined), 320) : null;
		return () => {
			window.cancelAnimationFrame(frame);
			if (timer !== null) {
				window.clearTimeout(timer);
			}
		};
	}, [src]);

	return (
		<div
			className={cn(
				"absolute inset-0 overflow-hidden",
				front ? "bg-stage-scrim" : "bg-transparent",
				className,
			)}
		>
			{!front ? (
				<EmptyState
					icon={Clapperboard}
					title={t("play.sceneEmpty")}
					description={t("play.sceneEmptyDescription")}
					className="pointer-events-none absolute inset-0 rounded-none bg-transparent"
				/>
			) : null}
			{back ? (
				<img
					src={back}
					alt=""
					className={cn(
						"absolute inset-0 size-full object-cover",
						imageClassName,
					)}
				/>
			) : null}
			{front ? (
				<img
					src={front}
					alt={alt}
					className={cn(
						"absolute inset-0 size-full object-cover transition-opacity duration-300 ease-expressive-default-effects",
						frontVisible ? "opacity-100" : "opacity-0",
						imageClassName,
					)}
				/>
			) : null}
		</div>
	);
}
