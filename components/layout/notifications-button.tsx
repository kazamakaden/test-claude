import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotificationsButton({
  label,
  unreadCount = 0,
}: {
  label: string;
  unreadCount?: number;
}) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} className="relative">
      <Bell />
      {unreadCount > 0 ? (
        <span
          className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent-glow ring-2 ring-card"
          aria-hidden
        />
      ) : null}
      <span className="sr-only">{`${label}${unreadCount > 0 ? ` (${unreadCount})` : ""}`}</span>
    </Button>
  );
}
