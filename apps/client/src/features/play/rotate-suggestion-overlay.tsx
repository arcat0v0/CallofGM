import { RotateCw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

type LockableOrientation = ScreenOrientation & {
	lock?: (mode: OrientationLockType) => Promise<void>;
};

export function canLockOrientation(): boolean {
	if (typeof screen === "undefined") {
		return false;
	}
	return (
		typeof (screen.orientation as LockableOrientation | undefined)?.lock ===
		"function"
	);
}

async function lockLandscape(): Promise<boolean> {
	if (!canLockOrientation()) {
		return false;
	}
	const orientation = screen.orientation as LockableOrientation;
	try {
		await orientation.lock?.("landscape");
		return true;
	} catch {
		try {
			await document.documentElement.requestFullscreen();
			await orientation.lock?.("landscape");
			return true;
		} catch {
			return false;
		}
	}
}

function RotateSuggestionOverlay({
	onDismiss,
	className,
}: {
	onDismiss: () => void;
	className?: string;
}) {
	const lockable = canLockOrientation();

	async function handleRotate() {
		const locked = await lockLandscape();
		if (locked) {
			onDismiss();
			return;
		}
		toast.message(t("play.rotateFailed"));
	}

	return (
		<div
			className={cn(
				"bg-modal-backdrop/90 absolute inset-0 z-40 flex items-center justify-center backdrop-blur-sm",
				className,
			)}
		>
			<Card className="bg-md-surface-container-high shadow-overlay w-[300px] items-center gap-5 rounded-2xl border-none px-6 py-8">
				<div className="bg-md-primary-container text-md-on-primary-container flex size-16 items-center justify-center rounded-full">
					<Smartphone className="size-8 rotate-90" />
				</div>
				<div className="flex flex-col items-center gap-2 text-center">
					<span className="text-foreground font-serif text-headline-small-emph">
						{t("play.rotateTitle")}
					</span>
					<p className="text-foreground-secondary font-sans text-body-medium">
						{t("play.rotateDescription")}
					</p>
					{lockable ? null : (
						<p className="text-foreground-tertiary font-sans text-label-small">
							{t("play.rotateUnsupportedNote")}
						</p>
					)}
				</div>
				<div className="flex w-full flex-col gap-2">
					{lockable ? (
						<Button
							type="button"
							variant="primary"
							className="h-11 w-full"
							onClick={() => void handleRotate()}
						>
							<RotateCw className="size-4" />
							{t("play.rotateAction")}
						</Button>
					) : null}
					<Button
						type="button"
						variant={lockable ? "ghost" : "primary"}
						onClick={onDismiss}
						className={cn(
							"w-full",
							lockable ? "h-9 text-foreground-secondary" : "h-11",
						)}
					>
						{lockable
							? t("play.rotateDismiss")
							: t("play.rotateDismissPortrait")}
					</Button>
				</div>
			</Card>
		</div>
	);
}

export { RotateSuggestionOverlay };
