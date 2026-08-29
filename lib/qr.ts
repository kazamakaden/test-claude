import QRCode from "qrcode";

/**
 * QR geometry for §13's check-in code, as plain data.
 *
 * Deliberately NOT an SVG string. `qrcode` can emit one directly, but rendering
 * it would need dangerouslySetInnerHTML, and this codebase has none anywhere —
 * CLAUDE.md records that absence as a checked security property, and "the
 * markup is ours so it's fine" is exactly the reasoning that erodes an
 * invariant like that. Returning a viewBox size plus an SVG path lets the
 * caller render a real <svg><path/></svg> in JSX, where `d` is just an
 * attribute value React escapes like any other.
 *
 * Error-correction M tolerates a partly-obscured code (a hand, a reflection,
 * projector glare) without inflating the module count the way H would.
 */
export interface QrGeometry {
  /** Module count per side; also the viewBox extent, since one module = 1 unit. */
  size: number;
  /** SVG path covering every dark module. */
  path: string;
}

export function qrGeometry(text: string): QrGeometry {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const data = qr.modules.data;

  // One horizontal run per contiguous group of dark modules, rather than one
  // rect per module: a 33x33 code is ~1000 modules, and runs cut the path to a
  // fraction of that with identical output.
  const parts: string[] = [];
  for (let y = 0; y < size; y += 1) {
    let runStart = -1;
    for (let x = 0; x <= size; x += 1) {
      const dark = x < size && Boolean(data[y * size + x]);
      if (dark && runStart === -1) runStart = x;
      if (!dark && runStart !== -1) {
        parts.push(`M${runStart} ${y}h${x - runStart}v1h-${x - runStart}z`);
        runStart = -1;
      }
    }
  }

  return { size, path: parts.join("") };
}

/**
 * The string a §13 attendance QR must encode.
 *
 * ALWAYS an absolute URL, never the bare token. A phone's camera app opens
 * this from outside the browser: given a bare token it has no URL to resolve
 * and simply displays the text, so the student never reaches /attend at all.
 *
 * This exists because the two places that build a QR drifted apart. The
 * initial render (components/attendance/qr-session-panel.tsx) built the URL
 * correctly; the rotation endpoint (app/api/qr/[sessionId]/route.ts) encoded
 * `token.token` on its own. The code rotates every few seconds, so in practice
 * almost every real scan got the bare-token version -- and the failure hid
 * behind a working first render, which is what a staff member testing the page
 * once would see. One builder now, used by both.
 *
 * resolveConfiguredSiteUrl() rather than the request's Origin header: this URL
 * is displayed to a room and scanned by devices that never sent that header,
 * so there is nothing to inherit it from. Same call the panel already made.
 */
export function attendUrl(origin: string, lang: string, token: string): string {
  return `${origin}/${lang}/attend/${token}`;
}
