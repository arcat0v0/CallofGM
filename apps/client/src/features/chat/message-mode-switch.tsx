import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t } from "@/i18n";

type MessageMode = "roleplay" | "ooc";

function MessageModeSwitch({
	value,
	onValueChange,
	roleplayDisabled = false,
}: {
	value: MessageMode;
	onValueChange: (value: MessageMode) => void;
	roleplayDisabled?: boolean;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="xs"
					aria-label={t("chat.modeLabel")}
					className="text-md-on-surface-variant h-6 shrink-0 gap-1 rounded-full px-2 text-label-small"
				>
					{value === "ooc" ? t("chat.ooc") : t("chat.roleplay")}
					<ChevronDown className="size-3.5" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-36">
				<DropdownMenuRadioGroup
					value={value}
					onValueChange={(next) => onValueChange(next as MessageMode)}
				>
					<DropdownMenuRadioItem value="roleplay" disabled={roleplayDisabled}>
						{t("chat.roleplay")}
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="ooc">
						{t("chat.ooc")}
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export type { MessageMode };
export { MessageModeSwitch };
