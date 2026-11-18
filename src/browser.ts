// Drawing a cover in a page your user already has open: a 1200 x 630 canvas, as a PNG, sent to
// your server. The server only checks it (isCover) and keeps it.
const W = 1200;
const H = 630;

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Draw on a 1200 x 630 canvas and get it back as a PNG. */
export async function drawCover(draw: (ctx: Ctx, width: number, height: number) => void | Promise<void>): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(W, H);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('liveog: no 2d canvas here');
    await draw(ctx, W, H);
    return c.convertToBlob({ type: 'image/png' });
  }
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('liveog: no 2d canvas here');
  await draw(ctx, W, H);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('liveog: the canvas gave no PNG'))), 'image/png'));
}

/** Send a cover to your server as the raw PNG; its answer is returned as it came. */
export function sendCover(url: string, png: Blob, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'image/png');
  return fetch(url, { ...init, method: 'POST', headers, body: png });
}
