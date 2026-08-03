import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requirePermission } from "@/lib/auth/require-role";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getDepartments } from "@/services/members";
import { getProject } from "@/services/projects";
import { parseProjectId } from "@/schemas/projects";
import { ProjectForm } from "@/components/projects/project-form";
import { SubmitProjectButton } from "@/components/projects/submit-project-button";
import { ProjectReviewActions } from "@/components/projects/project-review-actions";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/lib/i18n/config";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id: rawId } = await params;
  const lang = rawLang as Locale;

  await requirePermission("workspace:access", lang);

  const id = parseProjectId(rawId);
  if (!id) notFound();

  const [dict, role, project] = await Promise.all([getDictionary(lang), getRole(), getProject(id)]);
  if (!project) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = Boolean(user && user.id === project.ownerId);

  const d = dict.projects;
  const canEdit = isOwner && project.status === "draft";
  const canReviewTeacher = project.status === "teacher_review" && can(role, "project:recommend");
  const canReviewAdmin = project.status === "admin_approval" && can(role, "project:approve");

  const departments = canEdit ? await getDepartments() : [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/${lang}/projects`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {d.detail.backToList}
      </Link>

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
            {project.title}
          </h1>
          <Badge variant="outline">{d.status[project.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {d.detail.ownerLabel}: {project.ownerName ?? "—"}
        </p>
      </div>

      {project.rejectedReason ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <strong>{d.detail.rejectedReasonLabel}:</strong> {project.rejectedReason}
        </div>
      ) : null}

      {canEdit ? (
        <>
          <ProjectForm mode="edit" project={project} departments={departments} lang={lang} dict={dict} />
          <SubmitProjectButton id={project.id} lang={lang} label={d.actions.submit} />
        </>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="whitespace-pre-wrap text-sm text-foreground">{project.description || "—"}</p>
        </div>
      )}

      {canReviewTeacher ? (
        <ProjectReviewActions id={project.id} lang={lang} dict={dict} stage="teacher_review" />
      ) : null}
      {canReviewAdmin ? (
        <ProjectReviewActions id={project.id} lang={lang} dict={dict} stage="admin_approval" />
      ) : null}
    </div>
  );
}
