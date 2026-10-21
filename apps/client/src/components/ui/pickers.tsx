import { CalendarIcon, ClockIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function DatePicker({
  value,
  onChange,
  disabled,
  label = "选择日期",
  calendarProps,
}: {
  value?: Date;
  onChange: (value: Date | undefined) => void;
  disabled?: boolean;
  label?: string;
  calendarProps?: Omit<
    ComponentProps<typeof Calendar>,
    "mode" | "selected" | "onSelect"
  >;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <CalendarIcon data-icon="inline-start" />
          {value ? value.toLocaleDateString("zh-CN") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" aria-label={label}>
        <Calendar
          {...calendarProps}
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
function TimePicker({
  value = "21:00",
  onChange,
  label = "选择时间",
  disabled = false,
}: {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  const timeId = useId();
  const [part, setPart] = useState<"hour" | "minute">("hour");
  const [hour = "00", minute = "00"] = value.split(":");
  const current = Number(part === "hour" ? hour : minute);
  const handRadius = (part === "hour" && current >= 12 ? 0.27 : 0.4) * 256;
  const update = (next: number) => {
    const text = String(next).padStart(2, "0");
    onChange(part === "hour" ? `${text}:${minute}` : `${hour}:${text}`);
    if (part === "hour") setPart("minute");
  };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <ClockIcon data-icon="inline-start" />
          {value || label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogTitle>{label}</DialogTitle>
        <div className="flex justify-center gap-2">
          <Button
            variant={part === "hour" ? "tonal" : "ghost"}
            size="md"
            onClick={() => setPart("hour")}
            aria-pressed={part === "hour"}
          >
            {hour}
          </Button>
          <span className="self-center text-headline-large">:</span>
          <Button
            variant={part === "minute" ? "tonal" : "ghost"}
            size="md"
            onClick={() => setPart("minute")}
            aria-pressed={part === "minute"}
          >
            {minute}
          </Button>
        </div>
        <fieldset
          data-slot="time-dial"
          className="relative mx-auto size-64 rounded-full bg-md-surface-container-highest"
          aria-label={part === "hour" ? "小时" : "分钟"}
        >
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-full text-accent"
            viewBox="0 0 256 256"
          >
            <line
              x1="128"
              y1="128"
              x2={
                128 +
                Math.sin(
                  (current / (part === "hour" ? 12 : 60)) * Math.PI * 2,
                ) *
                  handRadius
              }
              y2={
                128 -
                Math.cos(
                  (current / (part === "hour" ? 12 : 60)) * Math.PI * 2,
                ) *
                  handRadius
              }
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle cx="128" cy="128" r="4" fill="currentColor" />
          </svg>
          {Array.from({ length: part === "hour" ? 24 : 12 }, (_, index) => {
            const angle = (index / 12) * Math.PI * 2;
            const n = part === "hour" ? index : index * 5;
            const radius = index >= 12 ? 27 : 40;
            return (
              <button
                type="button"
                data-slot="time-dial-value"
                key={n}
                onClick={() => update(n)}
                aria-pressed={current === n}
                aria-label={`${String(n).padStart(2, "0")}${part === "hour" ? " 时" : " 分"}`}
                className={cn(
                  "absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-label-large outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/50",
                  current === n && "bg-accent text-accent-foreground",
                )}
                style={{
                  left: `${50 + Math.sin(angle) * radius}%`,
                  top: `${50 - Math.cos(angle) * radius}%`,
                }}
              >
                {String(n).padStart(2, "0")}
              </button>
            );
          })}
        </fieldset>
        <Field>
          <FieldLabel htmlFor={timeId}>精确时间</FieldLabel>
          <Input
            id={timeId}
            type="time"
            value={value}
            onChange={(event) => {
              if (event.target.value) onChange(event.target.value);
            }}
          />
        </Field>
      </DialogContent>
    </Dialog>
  );
}
function PickerSection({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-start gap-6">{children}</div>;
}

export { DatePicker, PickerSection, TimePicker };
