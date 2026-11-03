import { createRootRoute, Outlet } from "@tanstack/react-router";
import { NotFoundPage } from "@/components/shared/not-found-page";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export const Route = createRootRoute({
	component: RootComponent,
	notFoundComponent: NotFoundPage,
});

function RootComponent() {
	return (
		<TooltipProvider>
			<Outlet />
			<Toaster />
		</TooltipProvider>
	);
}
