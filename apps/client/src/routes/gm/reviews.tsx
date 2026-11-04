import type { CharacterReviewDto } from "@cogm/shared";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ClipboardCheck, Link2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, ListSkeleton } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { t, useI18nVersion } from "@/i18n";
import { api, isApiError } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { formatStamp, initialsOf } from "@/lib/format";
import { requireGmAuth } from "@/lib/identity";

export const Route = createFileRoute("/gm/reviews")({
	beforeLoad: () => requireGmAuth(),
	component: ReviewsPage,
});

function ReviewsPage() {
	useI18nVersion();
	const [reviews, setReviews] = useState<CharacterReviewDto[]>([]);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const list = await api<
				CharacterReviewDto[] | { pending: CharacterReviewDto[] }
			>("/gm/reviews?status=pending");
			setReviews(Array.isArray(list) ? list : (list.pending ?? []));
		} catch (error) {
			toast.error(isApiError(error) ? error.message : t("gm.reviews.empty"));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function decide(review: CharacterReviewDto, approve: boolean) {
		try {
			await api(`/gm/reviews/${review.id}/decide`, {
				method: "POST",
				body: JSON.stringify({ approve }),
			});
			toast.success(
				approve ? t("gm.reviews.approved") : t("gm.reviews.rejected"),
			);
			await load();
		} catch (error) {
			toast.error(errorText(error, "gm.reviews.decideFailed"));
		}
	}

	return (
		<AdminLayout>
			<div className="flex flex-col gap-6">
				<PageHeader
					title={t("gm.reviews.title")}
					description={t("gm.reviews.description")}
				/>

				{loading ? (
					<ListSkeleton rows={3} />
				) : reviews.length === 0 ? (
					<EmptyState
						icon={ClipboardCheck}
						title={t("gm.reviews.empty")}
						description={t("gm.reviews.emptyHint")}
					/>
				) : (
					<div className="flex flex-col gap-3">
						<span className="text-foreground-secondary text-label-large">
							{t("gm.reviews.count", { count: reviews.length })}
						</span>
						<div className="animate-in fade-in slide-in-from-bottom-4 overflow-hidden rounded-2xl bg-md-surface-container duration-500 ease-standard-default-spatial">
							{reviews.map((review) => (
								<article
									key={review.id}
									className="border-separator-secondary/60 grid gap-4 border-b p-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6"
								>
									<div className="flex min-w-0 items-start gap-3.5">
										<Avatar
											size="lg"
											shape="arch"
											className="bg-md-primary-container"
										>
											<AvatarFallback className="text-md-on-primary-container font-sans text-title-medium-emph">
												{initialsOf(review.characterName)}
											</AvatarFallback>
										</Avatar>
										<div className="flex min-w-0 flex-col gap-1">
											<div className="flex flex-wrap items-center gap-2">
												<h2 className="text-foreground truncate font-sans text-title-medium-emph">
													{review.characterName}
												</h2>
												<Badge variant="soft" tone="default" size="sm">
													<Link2 className="size-3" />
													{review.scope === "session"
														? t("gm.reviews.scopeSession")
														: t("gm.reviews.scopeModule")}
												</Badge>
											</div>
											<div className="text-foreground-secondary truncate text-body-small">
												{review.submittedByName ?? review.submittedByUserId} · v
												{review.submittedSheetVersion}
											</div>
											<div className="text-foreground-tertiary flex flex-wrap items-center gap-x-3 gap-y-0.5 text-label-small">
												<span className="truncate">
													{t("gm.reviews.target")}{" "}
													{review.targetName ?? review.targetId}
												</span>
												<span>
													{t("gm.reviews.submittedAt", {
														time: formatStamp(review.createdAt),
													})}
												</span>
											</div>
										</div>
									</div>

									<div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
										<Button
											type="button"
											variant="accentSoft"
											size="sm"
											onClick={() => void decide(review, true)}
										>
											<Check className="size-3.5" />
											{t("gm.reviews.approve")}
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => void decide(review, false)}
										>
											<X className="size-3.5" />
											{t("gm.reviews.reject")}
										</Button>
									</div>
								</article>
							))}
						</div>
					</div>
				)}
			</div>
		</AdminLayout>
	);
}
