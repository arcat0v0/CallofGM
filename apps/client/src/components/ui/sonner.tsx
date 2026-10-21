import {
  CircleCheckIcon,
  InfoIcon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { Spinner } from "@/components/ui/loading-indicator";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Spinner />,
      }}
      style={
        {
          "--normal-bg": "var(--color-md-inverse-surface)",
          "--normal-text": "var(--color-md-inverse-on-surface)",
          "--normal-border": "var(--color-md-inverse-surface)",
          "--border-radius": "var(--radius-xs)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
