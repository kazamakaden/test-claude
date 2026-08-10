import { Sparkles } from "lucide-react";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { getContentBlock } from "@/services/content";
import { ContentBlockEditor } from "@/components/content/content-block-editor";
import { PageShell } from "@/components/layout/page-shell";
import type { Locale } from "@/lib/i18n/config";

const SLUG = "aft-11-good-11-skilled";

/**
 * Task 2: public page for "11 ดี 11 เก่ง อวท.", text editable in-app by
 * aft_teacher/admin (content:manage). Content is a single free-text block
 * per slug (schema-level: content_blocks, 0031/0032) — rendered plain
 * whitespace-pre-wrap, the same pattern as projects/[id] and
 * documents/manage/[id] use for long text. English falls back to Thai when
 * the English field is empty, per the confirmed decision.
 */
export default async function Aft11Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;

  const [dict, role, block] = await Promise.all([getDictionary(lang), getRole(), getContentBlock(SLUG)]);
  const d = dict.aft11;

  if (!block) {
    return (
      <PageShell
        title={d.title}
        icon={Sparkles}
        emptyTitle={dict.common.errorTitle}
        emptyDescription={dict.common.errorRetry}
      />
    );
  }

  const canManage = can(role, "content:manage");
  const title = lang === "en" ? (block.titleEn ?? block.titleTh) : block.titleTh;
  const body = lang === "en" ? (block.bodyEn ?? block.bodyTh) : block.bodyTh;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">{title}</h1>
      </div>

      {body ? (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="whitespace-pre-wrap text-sm text-foreground">{body}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-sm">
          <Sparkles className="size-10 text-muted-foreground" aria-hidden />
          <p className="font-heading text-base font-medium text-foreground">{d.empty}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{d.emptyDescription}</p>
        </div>
      )}

      {canManage ? <ContentBlockEditor block={block} lang={lang} dict={dict} /> : null}
    </div>
  );
}
