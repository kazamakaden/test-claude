import type { QrGeometry } from "@/lib/qr";

/**
 * A QR as real SVG elements — no innerHTML, no client-side encoder. The only
 * dynamic value is `d`, an ordinary attribute React escapes.
 *
 * Fixed white background regardless of theme: a QR must be dark-on-light to
 * scan, so this is one of the few places that deliberately does not follow the
 * §3 palette. Inverting it in dark mode would make it unreadable to a camera.
 */
export function QrCodeSvg({ geometry, title }: { geometry: QrGeometry; title: string }) {
  return (
    <svg
      viewBox={`0 0 ${geometry.size} ${geometry.size}`}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
      className="h-auto w-full rounded-lg bg-white p-3"
    >
      <path d={geometry.path} fill="#000000" />
    </svg>
  );
}
