import { SegmentedControl } from "@/components/shared/segmented-control";
import { t } from "@/i18n";

type MessageMode = "roleplay" | "ooc";

const MESSAGE_MODE_OPTIONS = [
  { value: "roleplay", label: "chat.roleplay" },
  { value: "ooc", label: "chat.oocMode" },
] as const;

function MessageModeSwitch({
  value,
  onValueChange,
  roleplayDisabled = false,
}: {
  value: MessageMode;
  onValueChange: (value: MessageMode) => void;
  roleplayDisabled?: boolean;
}) {
  const options = MESSAGE_MODE_OPTIONS.map((option) =>
    option.value === "roleplay" ? { ...option, disabled: roleplayDisabled } : option,
  );
  return (
    <SegmentedControl
      value={value}
      options={options.map((option) => ({ ...option, label: t(option.label) }))}
      onValueChange={onValueChange}
      className="rounded-full"
      itemClassName="h-6"
      aria-label={t("chat.modeLabel")}
    />
  );
}

export { MessageModeSwitch };
export type { MessageMode };
