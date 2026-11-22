import type { ReactNode } from "react";
import { AdminLayout } from "./admin-layout";

export function AdminWorkbench({ children }: { children: ReactNode }) {
	return (
		<AdminLayout bleed>
			<div className="min-h-full min-w-0 bg-md-surface p-3 xl:p-4">
				{children}
			</div>
		</AdminLayout>
	);
}

export function AdminWorkbenchHeader({
	title,
	description,
	actions,
}: {
	title: string;
	description?: string;
	actions?: ReactNode;
}) {
	return (
		<header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 pt-1">
			<div className="flex min-w-0 flex-col gap-0.5">
				<h1 className="text-headline-small-emph text-md-on-surface">{title}</h1>
				{description ? (
					<p className="text-pretty text-body-medium text-md-on-surface-variant">
						{description}
					</p>
				) : null}
			</div>
			{actions ? (
				<div className="flex flex-wrap items-center gap-2">{actions}</div>
			) : null}
		</header>
	);
}

export function AdminLedger({ children }: { children: ReactNode }) {
	return (
		<div className="min-w-0 [&>[data-slot=table-container]]:rounded-lg-inc [&>[data-slot=table-container]]:p-0 [&_th]:h-8 [&_th]:border-b [&_th]:border-md-outline-variant/60 [&_th]:text-label-medium [&_td]:border-md-outline-variant/35 [&_td]:bg-transparent [&_td]:py-2 [&_tbody_tr:hover]:bg-md-surface-container [&_tbody_tr:focus-within]:bg-md-surface-container motion-reduce:[&_tr]:transition-none">
			{children}
		</div>
	);
}
