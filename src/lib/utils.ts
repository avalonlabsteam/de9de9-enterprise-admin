import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** A real backend id (UUID), as opposed to a mock one like 'C-2041' or a mock company name. */
export function isLiveId(id: string | null | undefined): boolean {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id ?? "")
}

/** The light theme's ink (#232838) used as a paint — it needs a dark-mode stand-in (see index.css `tone-ink*`). */
export function isInk(hex: string | null | undefined): boolean {
  return (hex ?? "").toLowerCase() === "#232838"
}
