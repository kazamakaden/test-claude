import { User } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-role";
import { tryCreateClient } from "@/lib/supabase/server";
import { getOwnCitizenId, getOwnProfile } from "@/services/profiles";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { PageShell } from "@/components/layout/page-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProfileNameForm } from "@/components/profile/profile-name-form";
import { CitizenIdForm } from "@/components/profile/citizen-id-form";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { getInitials } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";

/**
 * Task 3: real /profile page, replacing the PageShell "coming soon" stub.
 * Only full_name is actually editable by the viewer themselves — see
 * types/profiles.ts's OwnProfile header for why student_id/department/
 * class/club/role render read-only instead of offering an edit the
 * database (prevent_member_identity_change, 0025) would reject.
 */
export default async function ProfilePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;

  await requirePermission("profile:read", lang);

  // tryCreateClient(), not createClient() — createClient() throws
  // synchronously when Supabase isn't configured, which this page's own
  // top-level await would let escape as an unhandled 500 (the exact crash
  // class already fixed for /documents and /members, see CLAUDE.md).
  const supabase = await tryCreateClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  // citizenId comes from the get_citizen_id() RPC, not from getOwnProfile's
  // select list: 0005's column allow-list excludes citizen_id, and widening it
  // would expose the column to every profiles read in the app.
  const [dict, profile, citizenId] = await Promise.all([
    getDictionary(lang),
    user ? getOwnProfile(user.id) : null,
    user ? getOwnCitizenId(user.id) : null,
  ]);
  const d = dict.profile;

  if (!profile) {
    return (
      <PageShell
        title={d.title}
        icon={User}
        emptyTitle={dict.common.errorTitle}
        emptyDescription={dict.common.errorRetry}
      />
    );
  }

  const initials = getInitials(profile.fullName);

  const readOnlyFields: { label: string; value: string | number | null }[] = [
    { label: d.roleLabel, value: dict.roles[profile.role] },
    { label: d.studentIdLabel, value: profile.studentId },
    { label: d.academicYearLabel, value: profile.academicYear },
    { label: d.classLabel, value: profile.className },
    { label: d.departmentLabel, value: profile.departmentName },
    { label: d.clubLabel, value: profile.clubName },
  ];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">{d.title}</h1>
        <p className="text-sm text-muted-foreground">{d.description}</p>
      </div>

      <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <AvatarImage src={profile.avatarUrl ?? undefined} referrerPolicy="no-referrer" />
            <AvatarFallback>{initials ?? <User className="size-5" />}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <p className="font-heading text-base font-medium text-foreground">{profile.fullName ?? d.notSet}</p>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{dict.roles[profile.role]}</Badge>
              <span className="text-xs text-muted-foreground">{profile.email}</span>
            </div>
          </div>
        </div>

        <ProfileNameForm lang={lang} fullName={profile.fullName} dict={dict} />

        <div className="border-t border-border pt-6">
          <CitizenIdForm lang={lang} citizenId={citizenId} dict={dict} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs text-muted-foreground">{d.readOnlyNote}</p>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {readOnlyFields.map((field) => (
            <div key={field.label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{field.label}</dt>
              <dd className="text-sm text-foreground">{field.value ?? d.notSet}</dd>
            </div>
          ))}
        </dl>
      </div>

      <SignOutButton lang={lang} label={d.signOut} />
    </div>
  );
}
