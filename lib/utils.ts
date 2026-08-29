import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** First + last name initials for an avatar fallback — null when there's nothing to derive one from (components/layout/user-menu.tsx, mobile-nav.tsx). */
export function getInitials(fullName: string | null): string | null {
  if (!fullName) return null
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  const initials = `${first}${last}`.toUpperCase()
  return initials || null
}
