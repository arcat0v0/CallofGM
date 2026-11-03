import { createContext, useContext } from "react";
import type { LoadedTheme } from "./loader";

export type ThemeContextValue = {
	theme: LoadedTheme | null;
	error: Error | null;
	loading: boolean;
};

export const ThemeContext = createContext<ThemeContextValue>({
	theme: null,
	error: null,
	loading: false,
});

export function useTheme(): ThemeContextValue {
	return useContext(ThemeContext);
}
