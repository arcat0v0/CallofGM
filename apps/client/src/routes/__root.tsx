import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { NotFoundPage } from "@/components/shared/not-found-page";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useRuntimeConfigStore } from "@/stores/runtime-config-store";

export const Route = createRootRoute({
	component: RootComponent,
	notFoundComponent: NotFoundPage,
});

function RootComponent() {
	useEffect(() => {
		void useRuntimeConfigStore.getState().load();
	}, []);

	return (
		<TooltipProvider>
			<Outlet />
			<Toaster />
		</TooltipProvider>
	);
}
