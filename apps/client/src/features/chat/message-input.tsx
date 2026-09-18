import { Send } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";

function MessageInput({
  placeholder,
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
}) {
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit?.();
  }

  return (
    <form className="flex items-center gap-2" onSubmit={handleSubmit}>
      <InputGroup className="h-10 flex-1 border-separator-secondary px-3.5">
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
        size="icon-md"
        aria-label="发送消息"
        disabled={disabled}
      >
        <Send />
      </Button>
    </form>
  );
}

export { MessageInput };
