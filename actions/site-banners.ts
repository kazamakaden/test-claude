"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require-role";
import { getSessionUserId } from "@/lib/auth/get-role";
import {
  createBannerSchema,
  publishBannerSchema,
  deleteBannerGroupSchema,
} from "@/schemas/site-banners";
import {
  createBannerDraft,
  publishBanner,
  deleteBannerGroup,
} from "@/services/site-banners";
import type { Locale } from "@/lib/i18n/config";

export type BannerActionResult = { ok: true } | { ok: false; messageKey: string };

/**
 * The typed confirmation for a delete. Checked HERE, server-side, not only in
 * the dialog — same rule as components/attendance/attendance-confirm-form.tsx
 * and the §17 signature flow. A confirmation the client can skip is decoration.
 */
const CONFIRM_TEXT_TH = "ยืนยัน";

/**
 * Every action re-checks `content:manage` server-side. That guard is COARSE and
 * deliberately not the boundary: 0065's policies check current_role() inside
 * each statement, so a caller who slips past this is still refused by the
 * database. This exists so a non-staff caller gets a clean redirect instead of
 * a raw error from a query that was never going to work.
 */

export async function createBannerAction(
  lang: Locale,
  storagePath: string
): Promise<BannerActionResult> {
  await requirePermission("content:manage", lang);

  const parsed = createBannerSchema.safeParse({ storagePath });
  if (!parsed.success) return { ok: false, messageKey: "invalidInput" };

  const userId = await getSessionUserId();
  if (!userId) return { ok: false, messageKey: "forbidden" };

  const result = await createBannerDraft(parsed.data.storagePath, userId);
  if (!result.ok) return { ok: false, messageKey: result.error };

  revalidatePath(`/${lang}`);
  return { ok: true };
}

export async function publishBannerAction(
  lang: Locale,
  id: string,
  academicYear: string,
  term: string
): Promise<BannerActionResult> {
  await requirePermission("content:manage", lang);

  const parsed = publishBannerSchema.safeParse({ id, academicYear, term });
  if (!parsed.success) return { ok: false, messageKey: "invalidInput" };

  const result = await publishBanner(parsed.data.id, parsed.data.academicYear, parsed.data.term);
  if (!result.ok) return { ok: false, messageKey: result.error };

  revalidatePath(`/${lang}`);
  return { ok: true };
}

export async function deleteBannerGroupAction(
  lang: Locale,
  target: string,
  confirmText: string
): Promise<BannerActionResult> {
  await requirePermission("content:manage", lang);

  if (confirmText.trim() !== CONFIRM_TEXT_TH) {
    return { ok: false, messageKey: "confirmTextMismatch" };
  }

  // `target` is the picker's option value: "drafts", or "2569-1".
  const parsed = deleteBannerGroupSchema.safeParse(parseTarget(target));
  if (!parsed.success) return { ok: false, messageKey: "invalidInput" };

  const result = await deleteBannerGroup(parsed.data);
  if (!result.ok) return { ok: false, messageKey: result.error };

  revalidatePath(`/${lang}`);
  return { ok: true };
}

function parseTarget(target: string): unknown {
  if (target === "drafts") return { scope: "drafts" };
  const [year, term] = target.split("-");
  return { scope: "term", academicYear: year, term };
}
