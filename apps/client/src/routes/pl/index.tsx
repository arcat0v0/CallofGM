import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/pl/")({
	beforeLoad: () => {
		throw redirect({ to: "/pl/characters" });
	},
});
