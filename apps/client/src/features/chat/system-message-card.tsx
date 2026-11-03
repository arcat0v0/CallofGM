import { Dices, EyeOff } from "lucide-react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

type SystemMessageView = {
	speakerName: string;
	speakerRoleLabel: string;
	time: string;
	body: string;
	hidden?: boolean;
	outcome?: "success" | "failure";
};

function SystemMessageCard({
	message,
	className,
}: {
	message: SystemMessageView;
	className?: string;
}) {
	const accent = message.hidden
		? "text-warning border-l-warning"
		: message.outcome === "failure"
			? "text-danger border-l-danger"
			: message.outcome === "success"
				? "text-md-primary border-l-md-primary"
				: "text-md-on-surface-variant border-l-md-outline";
	const target = message.body.match(/（目标值\s*([^）]+)）$/);
	const body = (
		target ? message.body.slice(0, target.index ?? 0).trimEnd() : message.body
	).replace(/ → SAN (\S+)$/, " → SAN $1");

	return (
		<div
			className={cn(
				"bg-md-surface-container-high border border-md-outline-variant/40 flex flex-col gap-2 rounded-lg border-l-2 p-3.5",
				accent,
				className,
			)}
		>
			<div className="flex items-center gap-2">
				{message.hidden ? (
					<EyeOff className="size-4 shrink-0" />
				) : (
					<Dices className="size-4 shrink-0" />
				)}
				<span className="min-w-0 flex-1 truncate text-label-medium">
					{message.speakerName} · {message.speakerRoleLabel}
				</span>
				<span className="text-md-outline shrink-0 font-mono text-label-small">
					{message.time}
				</span>
			</div>
			<p className="text-md-on-surface text-body-medium font-semibold whitespace-pre-wrap text-pretty break-words select-text">
				{body}
			</p>
			{target ? (
				<span className="text-md-outline font-mono text-label-small">
					{t("gm.workbench.targetValue", { value: target[1] ?? "" })}
				</span>
			) : null}
			{message.hidden ? (
				<span className="text-md-on-surface-variant text-label-small">
					{t("gm.workbench.privateRoll")}
				</span>
			) : null}
		</div>
	);
}

export type { SystemMessageView };
export { SystemMessageCard };
