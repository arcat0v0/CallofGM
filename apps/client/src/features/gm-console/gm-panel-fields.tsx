import { ChevronDown, Pencil, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

function GmPanelShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  className,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section
      role="region"
      aria-label={title}
      className={cn(
        "bg-md-surface-container animate-in fade-in slide-in-from-top-2 shadow-overlay flex max-h-[calc(100dvh_-_220px)] w-[584px] flex-col gap-3 overflow-hidden rounded-xl border border-md-outline-variant/35 p-5 duration-350 ease-standard-default-spatial 2xl:gap-4 2xl:p-6",
        className,
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-md-on-surface font-serif text-headline-small font-semibold">{title}</h2>
          <p className="text-md-on-surface-variant text-label-medium 2xl:text-label-large">{subtitle}</p>
        </div>
        <Button
          type="button"
          variant="tertiary"
          size="icon-sm"
          className="bg-md-surface-container-highest size-10 shrink-0"
          aria-label={t("common.close")}
          onClick={onClose}
        >
          <X />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pr-1 2xl:gap-5">{children}</div>
      {footer ? (
        <div className="border-separator-secondary/60 shrink-0 border-t pt-4">{footer}</div>
      ) : null}
    </section>
  );
}

function GmField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-md-surface-container-high border-field-border flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg border px-3 py-2 shadow-[inset_0_1px_0_#ffffff0a] transition-[background-color,border-color,box-shadow] duration-200 ease-standard-fast-effects hover:border-field-border-hover focus-within:border-field-border-focus focus-within:ring-4 focus-within:ring-focus-ring/35 2xl:px-3.5 2xl:py-2.5",
        className,
      )}
    >
      <span className="text-md-on-surface-variant text-label-small">{label}</span>
      <div className="flex min-w-0 items-center justify-between gap-2">{children}</div>
    </div>
  );
}

function GmSelectField({
  label,
  value,
  onValueChange,
  children,
  className,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          "group bg-md-surface-container-high border-field-border text-md-on-surface focus-visible:border-field-border-focus focus-visible:ring-focus-ring/35 flex h-auto w-full min-w-0 flex-col items-start justify-center gap-0.5 rounded-lg border px-3 py-2 text-left shadow-[inset_0_1px_0_#ffffff0a] transition-[background-color,border-color,box-shadow] duration-200 ease-standard-fast-effects hover:border-field-border-hover focus-visible:ring-4 data-[state=open]:border-field-border-focus data-[state=open]:ring-4 data-[state=open]:ring-focus-ring/35 2xl:px-3.5 2xl:py-2.5 [&>svg]:hidden",
          className,
        )}
      >
        <span className="text-md-on-surface-variant text-label-small">{label}</span>
        <span className="text-md-on-surface flex w-full min-w-0 items-center justify-between gap-2 text-label-large">
          <SelectValue placeholder={placeholder} className="truncate" />
          <ChevronDown className="text-md-on-surface-variant size-4 shrink-0" />
        </span>
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        sideOffset={6}
        className="bg-md-surface-container-highest border-md-outline-variant/60 min-w-[var(--radix-select-trigger-width)] w-[var(--radix-select-trigger-width)] border"
      >
        {children}
      </SelectContent>
    </Select>
  );
}

function GmValueField({
  label,
  value,
  onClick,
  disabled,
  actionLabel,
  className,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  disabled?: boolean;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={actionLabel ?? label}
      onClick={onClick}
      className={cn(
        "bg-md-surface-container-high border-field-border flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg border px-3 py-2 text-left shadow-[inset_0_1px_0_#ffffff0a] outline-none transition-[background-color,border-color,box-shadow] duration-200 ease-standard-fast-effects hover:border-field-border-hover focus-visible:border-field-border-focus focus-visible:ring-4 focus-visible:ring-focus-ring/35 disabled:pointer-events-none disabled:opacity-60 2xl:px-3.5 2xl:py-2.5",
        className,
      )}
    >
      <span className="text-md-on-surface-variant text-label-small">{label}</span>
      <span className="text-md-on-surface flex w-full min-w-0 items-center justify-between gap-2 text-label-large">
        <span className="truncate">{value}</span>
        {onClick ? (
          <span className="bg-md-surface-container-highest grid size-6 shrink-0 place-items-center rounded-full">
            <Pencil className="text-md-primary size-3.5" />
          </span>
        ) : null}
      </span>
    </button>
  );
}

function GmSelectItem({ value, children }: { value: string; children: ReactNode }) {
  return <SelectItem value={value}>{children}</SelectItem>;
}

export { GmField, GmPanelShell, GmSelectField, GmSelectItem, GmValueField };