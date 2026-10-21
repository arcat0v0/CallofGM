import { type ComponentProps, useId } from "react";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function TextField({
  label,
  description,
  error,
  variant = "filled",
  id,
  className,
  "aria-describedby": describedBy,
  ...props
}: ComponentProps<typeof Input> & {
  label: string;
  description?: string;
  error?: string;
  variant?: "filled" | "outlined";
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const helperId = `${fieldId}-description`;
  return (
    <Field data-invalid={Boolean(error)} className={className}>
      <div data-slot="text-field" data-variant={variant}>
        <Input
          {...props}
          id={fieldId}
          placeholder=" "
          aria-invalid={Boolean(error) || props["aria-invalid"]}
          aria-describedby={
            cn(describedBy, (description || error) && helperId) || undefined
          }
        />
        <label data-slot="floating-label" htmlFor={fieldId}>
          {label}
        </label>
      </div>
      {error ? (
        <FieldError id={helperId}>{error}</FieldError>
      ) : description ? (
        <FieldDescription id={helperId}>{description}</FieldDescription>
      ) : null}
    </Field>
  );
}

export { TextField };
