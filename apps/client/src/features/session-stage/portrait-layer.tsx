import { t } from "@/i18n";
import { mediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getRuleComponent } from "@/rules/registry";
import { usePlayStore } from "@/stores/play-store";
import { portraitSlots, portraitSlotWidths } from "./portrait-layout";

function Bar({
	label,
	current,
	max,
	barClassName,
}: {
	label: string;
	current: number;
	max: number;
	barClassName: string;
}) {
	const ratio = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
	return (
		<div className="flex flex-col gap-0.5">
			<div className="text-md-on-surface/85 flex items-baseline justify-between gap-2 text-label-small">
				<span>{label}</span>
				<span className="tabular-nums">
					{current}/{max}
				</span>
			</div>
			<div className="bg-md-scrim/40 h-[3px] overflow-hidden rounded-full">
				<div
					className={cn("h-full rounded-full", barClassName)}
					style={{ width: `${ratio}%` }}
				/>
			</div>
		</div>
	);
}

function PortraitLayer({
	className,
	compact = false,
	variant = "play",
	showNameplate = true,
	audience = "player",
}: {
	className?: string;
	compact?: boolean;
	variant?: "play" | "gm";
	showNameplate?: boolean;
	audience?: "player";
}) {
	const characters = usePlayStore((state) => state.characters);
	const layout = usePlayStore((state) => state.portraitLayout);
	const scale = usePlayStore((state) => state.portraitScale);
	const latestSpeaker = usePlayStore((state) => {
		for (let index = state.messages.length - 1; index >= 0; index -= 1) {
			const message = state.messages[index];
			if (message && message.tone !== "ooc") {
				return message.speakerName;
			}
		}
		return null;
	});
	const visible = characters
		.filter(
			(character) => character.kind === "pc" || character.currentExpressionKey,
		)
		.slice(0, 4);
	const slots = portraitSlots(visible.length, layout);
	const slotWidth = portraitSlotWidths(visible.length, layout);
	const emphasizeSpeaker =
		visible.length > 1 &&
		visible.some((character) => character.name === latestSpeaker);
	const heightClass = compact
		? scale === "lg"
			? "max-h-[46dvh]"
			: "max-h-[38dvh]"
		: scale === "lg"
			? "h-[68dvh] max-h-[760px]"
			: "h-[56dvh] max-h-[620px]";

	return (
		<div
			className={cn(
				"pointer-events-none absolute inset-x-0",
				compact ? "top-14 bottom-22" : "top-0 bottom-36",
				variant === "gm" && "top-0 bottom-0",
				className,
			)}
		>
			{visible.map((character, index) => {
				const portraits = character.portraits ?? [];
				const current =
					portraits.find(
						(item) => item.expressionKey === character.currentExpressionKey,
					) ??
					portraits.find((item) => item.isDefault) ??
					portraits[0];
				const ruleComponent = getRuleComponent(character.ruleId);
				const stateSource =
					audience === "player" &&
					character.kind === "npc" &&
					character.publicState !== undefined
						? character.publicState
						: character.state;
				const bars = ruleComponent.stateBars(stateSource);
				const statusLabels = stateSource
					? ruleComponent.statusLabelsOfState(stateSource)
					: [];
				const left = slots[index] ?? 50;
				const speaking = !emphasizeSpeaker || character.name === latestSpeaker;
				const depth = emphasizeSpeaker
					? speaking
						? 30
						: 10 + index
					: 10 - Math.abs(index - (visible.length - 1) / 2) * 2;
				return (
					<div
						key={character.characterId}
						className={cn(
							"absolute bottom-0 flex -translate-x-1/2 flex-col items-center gap-2 transition-[left,width,opacity,transform] duration-500 ease-standard-default-spatial",
							emphasizeSpeaker &&
								!speaking &&
								"scale-[0.98] opacity-55 saturate-75",
						)}
						style={{ left: `${left}%`, width: `${slotWidth}%`, zIndex: depth }}
					>
						{current ? (
							<img
								src={mediaUrl(current.portraitAssetId) ?? undefined}
								alt={character.name}
								className={cn(
									"w-full object-contain object-bottom drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)] [mask-image:linear-gradient(to_bottom,black_88%,transparent)]",
									heightClass,
								)}
							/>
						) : (
							<div
								role="img"
								aria-label={t("stage.portraitPendingAria", {
									name: character.name,
								})}
								className={cn(
									"bg-stage-panel relative flex w-full shrink-0 flex-col items-center justify-end overflow-hidden rounded-t-full rounded-b-xl",
									heightClass,
								)}
							>
								<span
									aria-hidden
									className="bg-md-on-surface/15 absolute bottom-0 left-1/2 h-[52%] w-[64%] -translate-x-1/2 rounded-t-full"
								/>
								<span
									aria-hidden
									className="bg-md-on-surface/15 absolute bottom-[44%] left-1/2 size-[28%] -translate-x-1/2 rounded-full"
								/>
								<span
									className={cn(
										"text-md-on-surface/85 relative font-serif",
										compact
											? "mb-1 text-title-medium-emph"
											: "mb-2 text-headline-small-emph",
									)}
								>
									{character.name.slice(0, 1)}
								</span>
								<span
									className={cn(
										"text-md-on-surface relative mb-2 text-label-small",
										compact && "mb-1",
									)}
								>
									{t("stage.portraitPending")}
								</span>
							</div>
						)}
						{showNameplate ? (
							<>
								<div
									className={cn(
										"bg-md-surface-container-low/85 border border-md-outline-variant/40 shadow-card shrink-0 rounded-xl backdrop-blur-xl",
										compact ? "px-2 py-1" : "px-2.5 py-1.5",
									)}
								>
									<span
										className={cn(
											"text-md-on-surface block text-center",
											compact
												? "text-label-small-emph"
												: "text-label-medium-emph",
										)}
									>
										{character.name}
									</span>
								</div>
								{bars.length > 0 || statusLabels.length > 0 ? (
									<div
										className={cn(
											"flex w-full max-w-40 flex-col",
											compact ? "gap-1" : "gap-1.5",
										)}
									>
										{bars.map((bar) => (
											<Bar
												key={bar.key}
												label={bar.label}
												current={bar.current}
												max={bar.max}
												barClassName={bar.barClassName}
											/>
										))}
										{statusLabels.length > 0 ? (
											<div className="text-warning text-center text-label-small">
												{statusLabels.join(" ")}
											</div>
										) : null}
									</div>
								) : character.kind === "npc" ? (
									<div className="text-md-on-surface/70 text-center text-label-small">
										NPC
									</div>
								) : null}
							</>
						) : null}
					</div>
				);
			})}
		</div>
	);
}

export { PortraitLayer };
