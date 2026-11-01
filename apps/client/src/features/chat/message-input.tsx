import { Send } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { t } from "@/i18n";

function MessageInput({
  placeholder,
  value,
  onChange,
  onSubmit,
  disabled,
  compact = false,
}: {
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit?.();
  }

  return (
    <form className="flex items-center gap-2" onSubmit={handleSubmit}>
      <InputGroup className={cn("flex-1 border-separator-secondary px-3.5", compact ? "h-9" : "h-10")}>
        <InputGroupInput
          placeholder={placeholder}
          aria-label={placeholder}
          className="text-body-medium"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          disabled={disabled}
        />
      </InputGroup>
      <Button
        type="submit"
        variant="primary"
        size={compact ? "icon-sm" : "icon-md"}
        aria-label={t("chat.send")}
        disabled={disabled}
      >
        <Send />
      </Button>
    </form>
  );
}

export { MessageInput };
