import type { CharacterReviewDto } from "@cogm/shared";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Link2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { t, useI18nVersion } from "@/i18n";
import { api, isApiError } from "@/lib/api";
import { errorText } from "@/lib/errors";
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
		<div className="flex flex-col gap-6">
			<PageHeader
				title={t("gm.reviews.title")}
				description={t("gm.reviews.description")}
			/>

			{loading ? (
				<p className="text-foreground-tertiary">{t("common.loading")}</p>
			) : reviews.length === 0 ? (
				<p className="text-foreground-tertiary">{t("gm.reviews.empty")}</p>
			) : (
				<div className="flex flex-col gap-3">
					{reviews.map((review) => (
						<Card key={review.id} className="flex items-center gap-4 p-4">
							<div className="flex min-w-0 flex-1 flex-col gap-0.5">
								<span className="truncate text-title-small-emph">
									{review.characterName}
								</span>
								<span className="text-foreground-tertiary text-label-small">
									{review.submittedByName ?? review.submittedByUserId} · v
									{review.submittedSheetVersion}
								</span>
							</div>
							<Badge variant="soft" tone="default" size="sm">
								<Link2 className="size-3" />
								{review.scope === "session"
									? t("gm.reviews.scopeSession")
									: t("gm.reviews.scopeModule")}
							</Badge>
							<div className="flex gap-1">
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
									variant="ghost"
									size="sm"
									onClick={() => void decide(review, false)}
								>
									<X className="size-3.5" />
									{t("gm.reviews.reject")}
								</Button>
							</div>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
