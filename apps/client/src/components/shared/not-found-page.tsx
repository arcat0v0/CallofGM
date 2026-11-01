import { Link } from "@tanstack/react-router";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

function NotFoundPage() {
  return (
    <main className="bg-background relative flex min-h-dvh w-full flex-col items-center justify-center gap-10 overflow-hidden px-6">
      <div
        aria-hidden
        className="bg-md-primary/12 pointer-events-none absolute -top-32 -left-32 size-105 rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="bg-md-tertiary/12 pointer-events-none absolute -right-40 -bottom-40 size-120 rounded-full blur-3xl"
      />

      <div className="animate-in fade-in slide-in-from-bottom-4 ease-expressive-default-spatial flex flex-col items-center gap-4 text-center duration-500">
        <Logo className="size-16" />
        <h1 className="text-foreground font-serif text-display-small-emph">{t("notFound.title")}</h1>
        <p className="text-md-on-surface-variant max-w-md text-body-large">
          {t("notFound.description")}
        </p>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 ease-expressive-default-spatial flex flex-wrap items-center justify-center gap-3 delay-150 duration-500">
        <Button asChild variant="primary" className="h-12 px-6">
          <Link to="/">
            <ArrowLeft />
            {t("notFound.home")}
          </Link>
        </Button>
        <Button asChild variant="tertiary" className="h-12 px-6">
          <Link to="/gm/login">
            <KeyRound />
            {t("home.gmEntry")}
          </Link>
        </Button>
      </div>

      <p className="text-foreground-tertiary font-sans text-label-small">
        {t("notFound.footer")}
      </p>
    </main>
  );
}

export { NotFoundPage };