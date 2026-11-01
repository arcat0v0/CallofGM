import { SegmentedControl } from "@/components/shared/segmented-control";

type MessageMode = "roleplay" | "ooc";

const MESSAGE_MODE_OPTIONS = [
  { value: "roleplay", label: "角色扮演" },
  { value: "ooc", label: "场外" },
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
      options={options}
      onValueChange={onValueChange}
      className="rounded-full"
      itemClassName="h-6"
      aria-label="发言类型"
    />
  );
}

export { MessageModeSwitch };
export type { MessageMode };
