import { SegmentedControl } from "@/components/shared/segmented-control";

type MessageMode = "roleplay" | "ooc";

const MESSAGE_MODE_OPTIONS = [
  { value: "roleplay", label: "角色扮演" },
  { value: "ooc", label: "场外" },
] as const;

function MessageModeSwitch({
  value,
  onValueChange,
}: {
  value: MessageMode;
  onValueChange: (value: MessageMode) => void;
}) {
  return (
    <SegmentedControl
      value={value}
      options={MESSAGE_MODE_OPTIONS}
      onValueChange={onValueChange}
      className="rounded-full"
      itemClassName="h-6 rounded-full"
      aria-label="发言类型"
    />
  );
}

export { MessageModeSwitch };
export type { MessageMode };
