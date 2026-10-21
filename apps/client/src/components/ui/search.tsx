import { SearchIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function SearchBar({
  className,
  label = "搜索",
  ...props
}: ComponentProps<"input"> & { label?: string }) {
  return (
    <div
      data-slot="search-bar"
      className={cn(
        "flex h-14 items-center gap-4 rounded-full bg-md-surface-container-high px-4 focus-within:ring-2 focus-within:ring-focus-ring",
        className,
      )}
    >
      <SearchIcon aria-hidden="true" className="size-6 text-foreground-muted" />
      <input
        type="search"
        aria-label={label}
        placeholder={label}
        className="w-full min-w-0 bg-transparent text-body-large outline-none placeholder:text-foreground-muted"
        {...props}
      />
    </div>
  );
}
function SearchView({
  trigger,
  children,
  title = "搜索",
}: {
  trigger: ReactNode;
  children: ReactNode;
  title?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent data-presentation="search" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export { SearchBar, SearchView };
