export function mediaUrl(assetId: string | null | undefined): string | null {
  if (!assetId) {
    return null;
  }
  return `/api/v1/media/${encodeURIComponent(assetId)}`;
}
