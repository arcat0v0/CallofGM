import { Eye, EyeOff } from "lucide-react";
import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

/** GM 暗骰开关：掷骰与鉴定共用同一状态，结果仅主持人可见。 */
function HiddenRollSwitch({
	checked,
	onCheckedChange,
	disabled,
	className,
}: {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	disabled?: boolean;
	className?: string;
}) {
	const id = useId();
	return (
		<div
			className={cn(
				"flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 transition-colors",
				checked ? "bg-warning-soft/60" : "bg-md-surface-container",
				className,
			)}
		>
			{checked ? (
				<EyeOff className="text-warning size-4 shrink-0" aria-hidden="true" />
			) : (
				<Eye
					className="text-md-on-surface-variant size-4 shrink-0"
					aria-hidden="true"
				/>
			)}
			<label htmlFor={id} className="flex min-w-0 flex-1 flex-col">
				<span className="text-md-on-surface text-label-large">
					{t("dice.hidden")}
				</span>
				<span className="text-md-on-surface-variant text-label-small">
					{checked ? t("dice.hiddenOn") : t("dice.hiddenOff")}
				</span>
			</label>
			<Switch
				id={id}
				size="sm"
				className="data-[state=checked]:bg-warning!"
				checked={checked}
				disabled={disabled}
				onCheckedChange={onCheckedChange}
			/>
		</div>
	);
}

export { HiddenRollSwitch };
