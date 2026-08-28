/**
 * Triggers a browser "save this file" prompt for an in-memory `Blob` —
 * used by the Reports screen's CSV export (`lib/queries/reports.ts`'s
 * `apiRequestCsv` result). A plain `<a href>` pointing at the API can't be
 * used for this: the admin console authenticates with an
 * `Authorization: Bearer` header (`api-client.ts`'s doc comment — the auth
 * cookie only carries the httpOnly refresh token), which a normal
 * browser-initiated navigation never attaches, so the download must go
 * through `fetch()` first and then be handed to the browser as a local
 * object URL.
 */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
