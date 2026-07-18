import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";

function MessageInput({ placeholder }: { placeholder: string }) {
  return (
    <div className="flex items-center gap-2">
      <InputGroup className="h-10 flex-1 border-separator-secondary px-3.5">
        <InputGroupInput placeholder={placeholder} aria-label={placeholder} className="text-[13px]" />
      </InputGroup>
      <Button
        type="button"
        variant="primaryGradient"
        size="icon-lg"
        aria-label="发送消息"
        className="rounded-full bg-linear-to-br"
      >
        <Send />
      </Button>
    </div>
  );
}

export { MessageInput };
