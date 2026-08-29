"use client";

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * §25 "Respect prefers-reduced-motion" for JS-driven animation.
 *
 * app/globals.css already zeroes animation/transition durations under this
 * media query, but that only governs CSS. Motion driven from JavaScript
 * (e.g. @animateicons/react, which bundles its own motion runtime) keeps
 * running regardless, so components using it need this explicit check.
 *
 * Starts `false` and resolves in an effect: `window.matchMedia` doesn't
 * exist during SSR, and assuming "reduced" server-side would flash the
 * animation off for everyone on hydration.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(QUERY);
    setReduced(mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
