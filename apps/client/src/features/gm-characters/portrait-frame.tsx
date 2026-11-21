import { useState } from "react";
import { cn } from "@/lib/utils";
import { monogramOf } from "./library-model";

/**
 * 人物立绘框：有立绘时铺满 3:4 画框；无立绘时显示安静的单字底片，
 * 让少数真实立绘成为画面里最亮的东西。
 */
export function PortraitFrame({
	name,
	src,
	size = "thumb",
	className,
}: {
	name: string;
	src: string | null | undefined;
	size?: "thumb" | "card" | "tile" | "hero";

	className?: string;
}) {
	const [failed, setFailed] = useState(false);
	const showImage = Boolean(src) && !failed;
	return (
		<div
			className={cn(
				"relative isolate flex shrink-0 items-center justify-center overflow-hidden bg-md-surface-container-high",
				size === "thumb" && "h-8 w-6 rounded-xs",
				size === "card" && "h-24 w-[4.5rem] rounded-sm",
				size === "tile" && "aspect-[3/4] w-full rounded-sm",
				size === "hero" && "h-72 w-full rounded-md",
				className,
			)}
		>
			{showImage ? (
				<img
					src={src ?? undefined}
					alt=""
					loading="lazy"
					decoding="async"
					onError={() => setFailed(true)}
					className={cn(
						"size-full object-cover",
						size === "hero" ? "object-[50%_18%]" : "object-top",
					)}
				/>
			) : (
				<span
					aria-hidden
					className={cn(
						"text-md-on-surface-variant/55 select-none font-sans",
						size === "thumb" && "text-label-large",
						size === "card" && "text-headline-small",
						size === "tile" && "text-headline-medium",
						size === "hero" && "text-display-medium",
					)}
				>
					{monogramOf(name)}
				</span>
			)}
		</div>
	);
}
