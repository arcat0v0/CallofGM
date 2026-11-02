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
        "flex h-11 items-center gap-3 rounded-full border border-field-border bg-field px-4 transition-[background-color,border-color,box-shadow] duration-200 ease-standard-fast-effects focus-within:border-field-border-focus focus-within:ring-4 focus-within:ring-focus-ring/35",
        className,
      )}
    >
      <SearchIcon aria-hidden="true" className="size-5 shrink-0 text-field-placeholder" />
      <input
        type="search"
        aria-label={label}
        placeholder={label}
        className="w-full min-w-0 bg-transparent text-body-medium outline-none placeholder:text-field-placeholder"
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
