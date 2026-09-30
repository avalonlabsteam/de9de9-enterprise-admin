import { useCallback, useRef } from 'react';

/** Tint of the row a deep link names (an alert's `?demande=`, `?inscription=`…). */
export const FOCUS_ROW_CLASS = 'bg-[#F1ECFD] dark:bg-[#7C5CE0]/[.12]';

/**
 * A callback ref for the row a deep link names: scrolls it into view the first
 * time it mounts, then leaves the scroll alone (a refetch must not jump back).
 */
export function useFocusScroll(): (el: HTMLElement | null) => void {
  const done = useRef(false);
  return useCallback((el: HTMLElement | null) => {
    if (!el || done.current) return;
    done.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
}
