import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { t, useI18nVersion } from "@/i18n";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  useI18nVersion();
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      return;
    }
    const fromLink = trimmed.match(/\/join\/([^/?#]+)/)?.[1];
    const sessionId = decodeURIComponent(fromLink ?? trimmed);
    void navigate({ to: "/join/$sessionId", params: { sessionId } });
  }

  return (
    <main className="bg-background relative flex min-h-dvh w-full flex-col items-center justify-center gap-12 overflow-hidden px-6">
      <div
        aria-hidden
        className="bg-md-primary/12 pointer-events-none absolute -top-32 -left-32 size-105 rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="bg-md-tertiary/12 pointer-events-none absolute -right-40 -bottom-40 size-120 rounded-full blur-3xl"
      />

      <div className="animate-in fade-in slide-in-from-bottom-4 ease-expressive-default-spatial flex flex-col items-center gap-4 duration-500">
        <Logo className="size-16" />
        <h1 className="text-foreground font-serif text-display-large-emph">{t("app.name")}</h1>
        <p className="text-md-on-surface-variant text-title-medium tracking-[2px]">{t("app.subtitle")}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="animate-in fade-in slide-in-from-bottom-4 ease-expressive-default-spatial flex w-full max-w-105 items-center gap-2.5 delay-150 duration-500"
      >
        <InputGroup className="h-14 flex-1 px-4">
          <InputGroupAddon>
            <LinkIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-label={t("home.codeLabel")}
            placeholder={t("home.codePlaceholder")}
          />
        </InputGroup>
        <Button type="submit" variant="primary" className="h-14 shrink-0 px-8">
          {t("home.enter")}
        </Button>
      </form>

      <Button
        asChild
        variant="ghost"
        size="sm"
        className="text-foreground-secondary animate-in fade-in ease-standard-default-effects absolute bottom-6 delay-300 duration-300"
      >
        <Link to="/gm/login">
          <KeyRound className="text-foreground-tertiary" />
          {t("home.gmEntry")}
        </Link>
      </Button>
    </main>
  );
}
