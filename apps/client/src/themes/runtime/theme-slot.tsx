import { Component, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import type { ThemeSlotCtxMap, ThemeSlotName } from "@cogm/theme-sdk";
import { getDefaultTheme } from "./registry";
import { useTheme } from "./theme-context";

class SlotBoundary extends Component<
  { resetKey: string; fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("theme slot failed", error, info.componentStack);
  }

  componentDidUpdate(previous: { resetKey: string }): void {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

type AnySlot = ComponentType<Record<string, unknown>>;

export function ThemeSlot<K extends ThemeSlotName>({
  name,
  ctx,
  fallback = null,
}: {
  name: K;
  ctx: ThemeSlotCtxMap[K];
  fallback?: ReactNode;
}) {
  const { theme } = useTheme();
  const Themed = theme?.definition.slots[name] as AnySlot | undefined;
  const Default = getDefaultTheme()?.slots[name] as AnySlot | undefined;
  const resetKey = theme ? `${theme.id}@${theme.version}:${name}` : `default:${name}`;

  if (Themed) {
    const defaultNode = Default ? (
      <SlotBoundary resetKey={`${resetKey}:fallback`} fallback={fallback}>
        <Default {...(ctx as Record<string, unknown>)} />
      </SlotBoundary>
    ) : (
      fallback
    );
    return (
      <SlotBoundary resetKey={resetKey} fallback={defaultNode}>
        <Themed {...(ctx as Record<string, unknown>)} />
      </SlotBoundary>
    );
  }

  if (Default) {
    return (
      <SlotBoundary resetKey={resetKey} fallback={fallback}>
        <Default {...(ctx as Record<string, unknown>)} />
      </SlotBoundary>
    );
  }

  return fallback;
}