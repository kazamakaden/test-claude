import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requirePermission } from "@/lib/auth/require-role";
import { listPendingProfiles } from "@/services/profiles";
import { getDepartments } from "@/services/members";
import { ApproveUserCard } from "@/components/approvals/approve-user-card";
import type { Locale } from "@/lib/i18n/config";

export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;

  // §19: the nav item is gated on member:approve, but that alone is UI only —
  // re-check server-side, same as every other protected page in this app.
  const actorRole = await requirePermission("member:approve", lang);

  const [dict, pending, departments] = await Promise.all([
    getDictionary(lang),
    listPendingProfiles(),
    getDepartments(),
  ]);
  const d = dict.approvals;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {d.title}
        </h1>
        <p className="text-sm text-muted-foreground">{d.description}</p>
      </div>

      {pending.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
          {d.empty}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((profile) => (
            <ApproveUserCard
              key={profile.id}
              profile={profile}
              departments={departments}
              actorRole={actorRole}
              lang={lang}
              dict={dict}
            />
          ))}
        </div>
      )}
    </div>
  );
}
