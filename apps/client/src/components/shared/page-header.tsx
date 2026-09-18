import type * as React from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = Omit<React.ComponentProps<"header">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
};

function PageHeader({ title, description, eyebrow, actions, className, ...props }: PageHeaderProps) {
  return (
    <header className={cn("flex items-start justify-between gap-6", className)} {...props}>
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow}
        <h1 className="font-serif text-headline-medium-emph text-balance text-foreground">{title}</h1>
        {description ? (
          <p className="max-w-3xl text-pretty text-body-medium text-foreground-secondary">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}

export { PageHeader };
