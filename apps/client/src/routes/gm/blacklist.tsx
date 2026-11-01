import { createFileRoute } from "@tanstack/react-router";
import type { BlacklistEntryDto } from "@cogm/shared";
import { ScanLine, Search, ShieldBan, ShieldOff, ShieldX, Timer, UserX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { BanPlayerDialog } from "@/features/gm-admin/dialogs/ban-player-dialog";
import { api, unwrapItems } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { t, useI18nVersion } from "@/i18n";
import { requireGmAuth } from "@/lib/identity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gm/blacklist")({
  beforeLoad: requireGmAuth,
  component: BlacklistPage,
});

type DurationTone = "warning" | "danger" | "default";

type BlacklistEntry = {
  fingerprintHash: string;
  fingerprint: string;
  note: string;
  duration: string;
  durationTone: DurationTone;
  remaining: string;
  remainingMuted?: boolean;
  bannedAt: string;
  active: boolean;
  permanent: boolean;
};

function formatStamp(epochMs: number): string {
  const date = new Date(epochMs);
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortHash(hash: string): string {
  return hash.length <= 16 ? hash : `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

function mapEntry(row: BlacklistEntryDto, now: number): BlacklistEntry {
  const active = row.expiresAt === null || row.expiresAt > now;
  let duration = t("gm.blacklist.permanentLabel");
  let durationTone: DurationTone = "danger";
  let remaining = "—";
  if (row.expiresAt !== null) {
    durationTone = "warning";
    const ms = row.expiresAt - row.createdAt;
    const hours = Math.round(ms / 3600_000);
    duration = hours >= 24 ? t("gm.blacklist.days", { count: Math.round(hours / 24) }) : t("gm.blacklist.hours", { count: Math.max(1, hours) });
    if (!active) {
      remaining = t("gm.blacklist.unbanned");
    } else {
      const left = row.expiresAt - now;
      const leftHours = Math.max(1, Math.round(left / 3600_000));
      remaining = leftHours >= 24 ? t("gm.blacklist.remainingDays", { count: Math.round(leftHours / 24) }) : t("gm.blacklist.remainingHours", { count: leftHours });
    }
  }
  return {
    fingerprintHash: row.fingerprintHash,
    fingerprint: shortHash(row.fingerprintHash),
    note: row.reason || "—",
    duration,
    durationTone: active ? durationTone : "default",
    remaining: active ? remaining : t("gm.blacklist.unbanned"),
    remainingMuted: !active,
    bannedAt: formatStamp(row.createdAt),
    active,
    permanent: row.expiresAt === null,
  };
}

function BlacklistPage() {
  useI18nVersion();
  const [banOpen, setBanOpen] = useState(false);
  const [unbanTarget, setUnbanTarget] = useState<BlacklistEntry | null>(null);
  const [rows, setRows] = useState<BlacklistEntryDto[]>([]);
  const [query, setQuery] = useState("");

  async function reload() {
    try {
      const data = await api<unknown>("/gm/blacklist");
      setRows(unwrapItems<BlacklistEntryDto>(data));
    } catch (error) {
      toast.error(errorText(error, "gm.blacklist.loadFailed"));
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const entries = useMemo(() => {
    const now = Date.now();
    const mapped = rows.map((row) => mapEntry(row, now));
    const q = query.trim();
    if (!q) {
      return mapped;
    }
    return mapped.filter((entry) => entry.fingerprint.includes(q) || entry.note.includes(q) || entry.fingerprintHash.includes(q));
  }, [rows, query]);

  const activeCount = entries.filter((entry) => entry.active).length;
  const permanentCount = entries.filter((entry) => entry.active && entry.permanent).length;

  return (
    <AdminLayout active="blacklist">
      <div className="flex h-full flex-col gap-5">
        <PageHeader
          title={t("gm.blacklist.title")}
          description={t("gm.blacklist.description")}
          actions={
            <>
              <InputGroup className="h-9 w-[220px] rounded-md border-separator-secondary">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("gm.blacklist.searchPlaceholder")}
                  aria-label={t("gm.blacklist.searchAria")}
                  className="text-label-large"
                />
              </InputGroup>
              <Button variant="dangerSoft" className="h-12 px-6" onClick={() => setBanOpen(true)}>
                <UserX />
                {t("gm.blacklist.manualBan")}
              </Button>
            </>
          }
        />

        <div className="animate-in fade-in slide-in-from-bottom-4 flex gap-3.5 duration-500 ease-standard-default-spatial">
          <MetricCard icon={ShieldBan} value={String(activeCount)} label={t("gm.blacklist.active")} tone="error" />
          <MetricCard icon={ShieldX} value={String(permanentCount)} label={t("gm.blacklist.permanent")} tone="tertiary" />
          <MetricCard icon={Timer} value={String(rows.length)} label={t("gm.blacklist.all")} tone="secondary" />
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 overflow-hidden rounded-2xl bg-md-surface-container delay-75 duration-500 ease-standard-default-spatial">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-58">{t("gm.blacklist.fingerprint")}</TableHead>
              <TableHead>{t("gm.blacklist.note")}</TableHead>
              <TableHead className="w-30">{t("gm.blacklist.duration")}</TableHead>
              <TableHead className="w-32">{t("gm.blacklist.remaining")}</TableHead>
              <TableHead className="w-30">{t("gm.blacklist.bannedAt")}</TableHead>
              <TableHead className="w-28">{t("gm.blacklist.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.fingerprintHash}>
                <TableCell>
                  <div className="flex items-center gap-2">
                <span className="bg-default flex size-[26px] items-center justify-center rounded-sm">
                  <ScanLine className="text-foreground-secondary size-3.5" />
                </span>
                <span className="text-foreground font-mono text-body-small">{entry.fingerprint}</span>
                  </div>
                </TableCell>
                <TableCell className="text-foreground-secondary truncate text-body-medium">{entry.note}</TableCell>
                <TableCell>
                  <Badge variant="soft" tone={entry.durationTone} size="sm" className="font-sans">
                    {entry.duration}
                  </Badge>
                </TableCell>
                <TableCell className={cn("text-body-small", entry.remainingMuted ? "text-foreground-tertiary" : "text-foreground")}>
                  {entry.remaining}
                </TableCell>
                <TableCell className="text-foreground-tertiary font-mono text-body-small">{entry.bannedAt}</TableCell>
                <TableCell>
                  {entry.active ? (
                  <Button
                    variant="tertiary"
                    size="sm"
                    className="h-7 px-3"
                    onClick={() => setUnbanTarget(entry)}
                  >
                    {t("gm.blacklist.unban")}
                  </Button>
                ) : (
                  <Button
                    variant="tertiary"
                    size="sm"
                    className="h-7 px-3"
                    onClick={() => setBanOpen(true)}
                  >
                    {t("gm.blacklist.reban")}
                  </Button>
                )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>

      <BanPlayerDialog
        open={banOpen}
        onOpenChange={setBanOpen}
        onBan={async (input) => {
          try {
            await api("/gm/blacklist", {
              method: "POST",
              body: JSON.stringify({
                playerId: input.playerId,
                reason: input.reason,
                ...(input.durationSeconds ? { durationSeconds: input.durationSeconds } : {}),
              }),
            });
            await reload();
          } catch (error) {
            toast.error(errorText(error, "gm.blacklist.banFailed"));
            throw error;
          }
        }}
      />
      <ConfirmDialog
        open={unbanTarget !== null}
        onOpenChange={(open) => !open && setUnbanTarget(null)}
        icon={ShieldOff}
        title={t("gm.blacklist.unbanTitle")}
        description={t("gm.blacklist.unbanDescription", { fingerprint: unbanTarget?.fingerprint ?? "" })}
        confirmLabel={t("gm.blacklist.unbanConfirm")}
        confirmIcon={ShieldOff}
        variant="warning"
        onConfirm={() => {
          const target = unbanTarget;
          setUnbanTarget(null);
          if (!target) {
            return;
          }
          void api("/gm/blacklist/unban", {
            method: "POST",
            body: JSON.stringify({ fingerprintHash: target.fingerprintHash }),
          })
            .then(() => reload())
            .catch((error) => toast.error(errorText(error, "gm.blacklist.unbanFailed")));
        }}
      />
    </AdminLayout>
  );
}
