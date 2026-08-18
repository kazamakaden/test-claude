"use client";

import { useState } from "react";
import Link from "next/link";
import { QrCode } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * "Generate QR code" on the activity page: click to reveal the live code
 * without leaving the page.
 *
 * The panel itself is rendered on the server and passed in as `children`,
 * because minting the first token needs getCurrentQrToken() and the session
 * secret must never reach the browser. This component only decides whether the
 * already-rendered markup is shown -- it cannot derive a code, which is the
 * whole security argument for the polling route (0056).
 *
 * The full-screen /qr route stays, for projecting on a wall.
 */
export function InlineQrPanel({
  activityId,
  lang,
  dict,
  children,
}: {
  activityId: string;
  lang: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  const d = dict.activities.qrPanel;
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{d.heading}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant={open ? "outline" : "default"} onClick={() => setOpen((v) => !v)}>
            <QrCode aria-hidden className="mr-2 size-4" />
            {open ? d.hide : d.generate}
          </Button>
          <Link
            href={`/${lang}/activities/${activityId}/qr`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            {d.openFull}
          </Link>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="flex flex-col gap-3">
          {children}
          <p className="text-xs text-muted-foreground">{d.note}</p>
        </CardContent>
      )}
    </Card>
  );
}
