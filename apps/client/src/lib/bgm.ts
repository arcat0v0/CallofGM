import { Howl } from "howler";
import { useEffect, useRef } from "react";
import type { BgmState, SePlayedEvent } from "@cogm/shared";
import { mediaUrl } from "./api";
import { effectiveVolume } from "./local-volume";
import { usePlayStore } from "@/stores/play-store";

function currentBgmPosition(bgm: BgmState): number {
  let position = bgm.seekOffsetMs;
  if (bgm.playing) {
    position += Math.max(0, Date.now() - bgm.startedAtMs);
  }
  const duration = bgm.durationMs ?? 0;
  if (bgm.loop && duration > 0) {
    return position % duration;
  }
  return position;
}

export function useBgmPlayback(
  bgm: BgmState | null,
  audioAssetId: string | null | undefined,
  seCue?: SePlayedEvent | null,
  onSePlayed?: () => void,
  options?: { muted?: boolean; localVolume?: number; isGm?: boolean; transitionMs?: number },
): void {
  const howlRef = useRef<Howl | null>(null);
  const assetRef = useRef<string | null>(null);
  const seRef = useRef<{ howl: Howl; broadcastVolume: number } | null>(null);
  const muted = options?.muted ?? false;
  const localVolume = options?.localVolume ?? 100;
  const isGm = options?.isGm ?? false;
  const transitionMs = Math.max(0, options?.transitionMs ?? 400);

  useEffect(() => {
    const unlock = () => {
      const unlockHowl = new Howl({
        src: ["data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="],
        volume: 0,
      });
      unlockHowl.play();
      unlockHowl.unload();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    const src = audioAssetId ? mediaUrl(audioAssetId) : "";
    if (!src || !bgm) {
      howlRef.current?.unload();
      howlRef.current = null;
      assetRef.current = null;
      return;
    }

    if (assetRef.current !== audioAssetId) {
      howlRef.current?.unload();
      howlRef.current = new Howl({
        src: [src],
        html5: true,
        xhr: { withCredentials: true },
        loop: bgm.loop,
        volume: 0,
      });
      assetRef.current = audioAssetId ?? null;
    }

    const howl = howlRef.current;
    if (!howl) {
      return;
    }

    howl.loop(bgm.loop);
    const targetVolume = effectiveVolume({
      broadcastVolume: bgm.volume,
      localVolume,
      muted,
      isGm,
    });
    if (Math.abs(howl.volume() - targetVolume) > 0.01) {
      if (transitionMs > 0 && howl.state() === "loaded") {
        howl.fade(howl.volume(), targetVolume, transitionMs);
      } else {
        howl.volume(targetVolume);
      }
    }
    const seekSec = currentBgmPosition(bgm) / 1000;
    const currentSeek = typeof howl.seek() === "number" ? Number(howl.seek()) : 0;
    if (Math.abs(currentSeek - seekSec) > 0.75) {
      howl.seek(seekSec);
    }
    if (bgm.playing) {
      if (!howl.playing()) {
        howl.play();
      }
    } else if (howl.playing()) {
      howl.pause();
    }
  }, [audioAssetId, bgm, isGm, localVolume, muted, transitionMs]);

  useEffect(() => {
    if (!seCue) {
      return;
    }
    const src = seCue.audioAssetId ? mediaUrl(seCue.audioAssetId) : "";
    if (!src) {
      onSePlayed?.();
      return;
    }
    const broadcastVolume = seCue.volume ?? 100;
    const se = new Howl({
      src: [src],
      html5: true,
      xhr: { withCredentials: true },
      volume: effectiveVolume({ broadcastVolume, localVolume, muted, isGm }),
    });
    seRef.current = { howl: se, broadcastVolume };
    se.once("end", () => {
      se.unload();
      if (seRef.current?.howl === se) {
        seRef.current = null;
      }
    });
    se.play();
    onSePlayed?.();
  }, [onSePlayed, seCue]);

  useEffect(() => {
    const active = seRef.current;
    if (!active) {
      return;
    }
    active.howl.volume(
      effectiveVolume({
        broadcastVolume: active.broadcastVolume,
        localVolume,
        muted,
        isGm,
      }),
    );
  }, [isGm, localVolume, muted]);

  useEffect(() => {
    return () => {
      howlRef.current?.unload();
      howlRef.current = null;
      seRef.current?.howl.unload();
      seRef.current = null;
    };
  }, []);
}

export function usePlayAudio(): void {
  const bgm = usePlayStore((state) => state.bgm);
  const seCue = usePlayStore((state) => state.seCue);
  const clearSeCue = usePlayStore((state) => state.clearSeCue);
  const tracks = usePlayStore((state) => state.catalogTracks);
  const muted = usePlayStore((state) => state.muted);
  const localVolume = usePlayStore((state) => state.localVolume);
  const isGm = usePlayStore((state) => state.viewer.isGm);
  const transitionMs = usePlayStore((state) => state.bgmTransitionMs);
  const audioAssetId = bgm?.audioAssetId ?? tracks.find((track) => track.id === bgm?.trackId)?.audioAssetId ?? null;
  useBgmPlayback(bgm, audioAssetId, seCue, clearSeCue, { muted, localVolume, isGm, transitionMs });
}
