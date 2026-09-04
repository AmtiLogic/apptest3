"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Measures an element's rendered width.
 *
 * Charts render at this width 1:1 rather than scaling a fixed viewBox, so axis
 * labels stay at their real pixel size on a narrow phone screen instead of being
 * shrunk to a few pixels tall.
 */
export function useElementWidth<T extends HTMLElement>(fallback = 320) {
  const [width, setWidth] = useState(fallback);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect();
    if (!node) return;

    setWidth(node.getBoundingClientRect().width || fallback);
    observer.current = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next) setWidth(next);
    });
    observer.current.observe(node);
  }, [fallback]);

  useEffect(() => () => observer.current?.disconnect(), []);

  return { ref, width };
}
