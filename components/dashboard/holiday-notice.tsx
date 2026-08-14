import { Info, TriangleAlert } from "lucide-react";
import type { HolidayFeedStatus } from "@/types/holidays";
import type { Dictionary } from "@/types/i18n";

/**
 * Provenance note for the ปฏิทินวันหยุด panel.
 *
 * Thai public holidays are not a fixed list: วันหยุดชดเชย and special closures
 * are declared by ประกาศสำนักนายกรัฐมนตรี, and the feed this app reads is a
 * third party's dataset refreshed on a 24-hour cache
 * (`services/holidays.ts`, `revalidate: 86400`). Both facts are invisible in a
 * bare list of dates, so anyone scheduling around them would reasonably assume
 * the list is authoritative and current. It is neither, and the UI has to say
 * so rather than let the omission do the lying.
 *
 * Two states, driven by `HolidayFeed.status` rather than by an empty array —
 * several Thai months genuinely contain no public holiday, so keying the
 * warning on `holidays.length === 0` would fire on perfectly healthy months
 * and train people to ignore it.
 *
 * `role="status"` on the failure case only: a permanent advisory note
 * announcing itself on every page load is noise, whereas "this data could not
 * be verified" is a state change worth surfacing to a screen reader.
 * Deliberately not `role="alert"` — nothing here is urgent enough to interrupt.
 *
 * Monochrome per §3: no new hue, only existing tokens.
 */
export function HolidayNotice({ status, dict }: { status: HolidayFeedStatus; dict: Dictionary }) {
  const d = dict.dashboard.holidays.notice;

  if (status === "unavailable") {
    return (
      <div
        role="status"
        className="mt-4 flex gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3"
      >
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-foreground">{d.unavailableTitle}</p>
          <p className="text-xs text-muted-foreground">{d.unavailableBody}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex gap-2 rounded-lg border border-border bg-muted/40 p-3">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <p className="text-xs leading-relaxed text-muted-foreground">
        {d.syncBody} {d.verifyBody}
      </p>
    </div>
  );
}
