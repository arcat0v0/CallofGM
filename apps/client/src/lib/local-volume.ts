export const LOCAL_VOLUME_MIN = 0;
export const LOCAL_VOLUME_MAX = 100;
export const LOCAL_VOLUME_DEFAULT = 100;

export function normalizeLocalVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return LOCAL_VOLUME_DEFAULT;
  }
  return Math.min(LOCAL_VOLUME_MAX, Math.max(LOCAL_VOLUME_MIN, Math.round(value)));
}

export function effectiveVolume({
  broadcastVolume,
  localVolume,
  muted,
  isGm,
}: {
  broadcastVolume: number;
  localVolume: number;
  muted: boolean;
  isGm: boolean;
}): number {
  if (muted) {
    return 0;
  }
  const broadcast = Number.isFinite(broadcastVolume)
    ? Math.min(LOCAL_VOLUME_MAX, Math.max(LOCAL_VOLUME_MIN, broadcastVolume))
    : 0;
  const local = isGm ? LOCAL_VOLUME_MAX : normalizeLocalVolume(localVolume);
  return (broadcast / LOCAL_VOLUME_MAX) * (local / LOCAL_VOLUME_MAX);
}
