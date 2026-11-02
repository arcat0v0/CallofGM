import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const GM_TOOLS = ["scene", "characters", "handouts", "check", "audio"] as const;

type GmTool = (typeof GM_TOOLS)[number];

type GmToolContextValue = {
  activeTool: GmTool | null;
  openTool: (tool: GmTool) => void;
  closeTool: () => void;
  toggleTool: (tool: GmTool) => void;
};

const GmToolContext = createContext<GmToolContextValue | null>(null);

function GmToolProvider({ children }: { children: ReactNode }) {
  const [activeTool, setActiveTool] = useState<GmTool | null>(null);
  const openTool = useCallback((tool: GmTool) => setActiveTool(tool), []);
  const closeTool = useCallback(() => setActiveTool(null), []);
  const toggleTool = useCallback(
    (tool: GmTool) => setActiveTool((current) => (current === tool ? null : tool)),
    [],
  );
  const value = useMemo(
    () => ({ activeTool, openTool, closeTool, toggleTool }),
    [activeTool, closeTool, openTool, toggleTool],
  );
  return <GmToolContext.Provider value={value}>{children}</GmToolContext.Provider>;
}

function useGmTool(): GmToolContextValue {
  const context = useContext(GmToolContext);
  if (!context) {
    throw new Error("useGmTool must be used inside GmToolProvider");
  }
  return context;
}

export { GmToolProvider, useGmTool };
export type { GmTool };