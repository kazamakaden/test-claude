/**
 * Generated from the live project (hmkciwgzbdszsgnbeakc) via
 * `generate_typescript_types` after migrations 0001–0053 were applied live
 * (2026-08-03/04, 0030 applied 2026-08-09, 0036–0038 applied 2026-08-11,
 * 0053 applied 2026-08-14).
 * Genuinely regenerated each time a migration adds/removes a column or
 * table — do not hand-patch this file; the discipline that broke down
 * before (a hand-patched type drifting from the live schema) is exactly
 * what this note exists to prevent happening again.
 *
 * `profiles.password_set` (0030) was written to the repo's migration file
 * long before it was actually applied to this project — discovered and
 * fixed live: `services/members.ts#createMember`'s post-create profile
 * UPDATE was failing with `42703 undefined column` against the real
 * schema, which tripped its own rollback and silently deleted every account
 * "Add user" created. Applied now; selectable by `authenticated` per the
 * 0030 grant, same allow-list pattern as every other profiles column below.
 *
 * Regenerate with:
 *
 *   supabase gen types typescript --linked > types/database.ts
 *
 * `profiles.citizen_id` appears in this type because the column exists, but
 * it is NOT selectable by `authenticated`/`anon` at runtime — see
 * 0005_citizen_id_column_grants.sql. Read it only via `get_citizen_id()`.
 * `profiles.email` is also unselectable by `anon` (0026 grants anon a
 * narrower column allow-list than `authenticated` gets) — see
 * services/members.ts's `includeEmail` split.
 *
 * `attendance`'s `gps_lat`/`gps_lng`/`device_fingerprint`/`browser`/`ip`
 * columns are similarly present in the type but not selectable — see
 * 0008_dashboard_rls.sql. `select("*")` on either table compiles but fails
 * at the database with 42501 for any non-service-role client.
 *
 * `approved_accounts` (0011) was dropped by 0020_pending_signup_flow.sql —
 * no longer present in this type. `handle_new_user()` (rewritten in 0023)
 * now splits by address shape: a numeric local part lands `role =
 * 'pending'` and needs an admin or aft_teacher to assign a real role via
 * `/approvals`; a named local part lands `role = 'teacher'` immediately.
 *
 * `profiles.avatar_url` (0022) is Google's profile photo URL, copied in by
 * `handle_new_user()` only for accounts with a linked Google identity
 * (0023) — like `full_name`, it stays selectable by `authenticated` (see
 * the 0022 grant) since it is not sensitive, unlike citizen_id/attendance
 * above.
 *
 * `documents.cover_url`/`description`/`published_at` (0013) are public book
 * metadata, not sensitive — no column-grant restriction needed, unlike
 * citizen_id/attendance above. `flipbook_url` is GONE from both `documents`
 * and `books` as of 0053_remove_fliphtml5.sql, along with its CHECK
 * constraints: the third-party flipbook host was removed and books are now
 * plain PDFs in the private `books` Storage bucket. `books` additionally
 * carries books_published_needs_pdf (0053), so a published book always has
 * a pdf_path.
 *
 * `books` (0027–0029) is a separate table from `documents`, not an
 * extension of it — see 0027's header comment for why (documents.status is
 * welded to the §12 signature workflow, and documents deliberately has no
 * owner-DELETE policy). `academic_year` here is the 4-digit Buddhist year
 * (e.g. 2569), NOT the 2-digit form `profiles.academic_year` uses — same
 * name, different unit, do not conflate them. `pdf_path`/`cover_path` are
 * Storage object paths in the private `books`/`book-covers` buckets, not
 * URLs — a signed URL is minted per request (see lib/books.ts), which is
 * what keeps a draft's PDF unguessable while it's unpublished. Publishing
 * is gated on aft_teacher/admin (`books_staff_all`, 0028); an owner can
 * only ever write `status = 'draft'` (`books_update_own_draft`).
 *
 * `notifications` lost its `read` boolean in 0037: read state now lives in
 * `notification_reads`, one row per (notification, user). A broadcast row
 * (`recipient_id` null) is shared by every user, so a single boolean on the
 * row could never track per-user state — and the old
 * `notifications_update_own_read` policy (`recipient_id = auth.uid()`)
 * excluded broadcasts entirely, so nobody could mark one read at all.
 * `message_key`/`message_params` (0036) hold a dictionary key plus its
 * interpolation params for system-generated rows, so a notification is
 * stored once and rendered in the reader's own language; `title` is the
 * fallback for free-text/announcement rows. Rows are written by the three
 * `notify_*` triggers (0036), never by app code.
 *
 * NOTE for anything counting or listing "my notifications": RLS is the
 * security floor, not the app-level definition. `notifications_all_admin`
 * (0008) matches *every* row for an admin, so a query relying on RLS alone
 * would show an admin everyone else's private notifications. Always filter
 * `recipient_id = <me> or recipient_id is null` explicitly — both 0037 RPCs
 * and services/notifications.ts do.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          academic_year: number | null
          club_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          ends_at: string | null
          id: string
          is_public: boolean
          location: string | null
          starts_at: string
          status: Database["public"]["Enums"]["activity_status"]
          title: string
          updated_at: string
        }
        Insert: {
          academic_year?: number | null
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_public?: boolean
          location?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["activity_status"]
          title: string
          updated_at?: string
        }
        Update: {
          academic_year?: number | null
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_public?: boolean
          location?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["activity_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          activity_id: string
          browser: string | null
          class_name: string | null
          created_at: string
          department_id: string | null
          device_fingerprint: string | null
          gps_lat: number | null
          gps_lng: number | null
          id: string
          ip: unknown
          recorded_at: string
          room: string | null
          status: Database["public"]["Enums"]["activity_status"]
          student_id: string
        }
        Insert: {
          activity_id: string
          browser?: string | null
          class_name?: string | null
          created_at?: string
          department_id?: string | null
          device_fingerprint?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          ip?: unknown
          recorded_at?: string
          room?: string | null
          status?: Database["public"]["Enums"]["activity_status"]
          student_id: string
        }
        Update: {
          activity_id?: string
          browser?: string | null
          class_name?: string | null
          created_at?: string
          department_id?: string | null
          device_fingerprint?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          ip?: unknown
          recorded_at?: string
          room?: string | null
          status?: Database["public"]["Enums"]["activity_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          academic_year: number
          cover_path: string | null
          created_at: string
          description: string | null
          id: string
          owner_id: string | null
          pdf_path: string | null
          published_at: string | null
          published_by: string | null
          season: number
          source_document_id: string | null
          status: Database["public"]["Enums"]["book_status"]
          title: string
          updated_at: string
        }
        Insert: {
          academic_year: number
          cover_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string | null
          pdf_path?: string | null
          published_at?: string | null
          published_by?: string | null
          season: number
          source_document_id?: string | null
          status?: Database["public"]["Enums"]["book_status"]
          title: string
          updated_at?: string
        }
        Update: {
          academic_year?: number
          cover_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string | null
          pdf_path?: string | null
          published_at?: string | null
          published_by?: string | null
          season?: number
          source_document_id?: string | null
          status?: Database["public"]["Enums"]["book_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          id: string
          name_en: string
          name_th: string
        }
        Insert: {
          id?: string
          name_en: string
          name_th: string
        }
        Update: {
          id?: string
          name_en?: string
          name_th?: string
        }
        Relationships: []
      }
      content_blocks: {
        Row: {
          body_en: string | null
          body_th: string
          created_at: string
          slug: string
          title_en: string | null
          title_th: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_en?: string | null
          body_th?: string
          created_at?: string
          slug: string
          title_en?: string | null
          title_th: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_en?: string | null
          body_th?: string
          created_at?: string
          slug?: string
          title_en?: string | null
          title_th?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_blocks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          id: string
          name_en: string
          name_th: string
        }
        Insert: {
          code: string
          id?: string
          name_en: string
          name_th: string
        }
        Update: {
          code?: string
          id?: string
          name_en?: string
          name_th?: string
        }
        Relationships: []
      }
      document_drafts: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          document_id: string
          id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          document_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_drafts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          owner_id: string | null
          published_at: string | null
          rejected_reason: string | null
          status: Database["public"]["Enums"]["document_status"]
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string | null
          published_at?: string | null
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string | null
          published_at?: string | null
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          message_key: string | null
          message_params: Json | null
          recipient_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          message_key?: string | null
          message_params?: Json | null
          recipient_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          message_key?: string | null
          message_params?: Json | null
          recipient_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          academic_year: number | null
          avatar_url: string | null
          citizen_id: string | null
          class_name: string | null
          club_id: string | null
          created_at: string
          department_id: string | null
          email: string
          full_name: string | null
          id: string
          password_set: boolean
          position: Database["public"]["Enums"]["member_position"] | null
          role: Database["public"]["Enums"]["user_role"]
          student_id: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: number | null
          avatar_url?: string | null
          citizen_id?: string | null
          class_name?: string | null
          club_id?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          full_name?: string | null
          id: string
          password_set?: boolean
          position?: Database["public"]["Enums"]["member_position"] | null
          role?: Database["public"]["Enums"]["user_role"]
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: number | null
          avatar_url?: string | null
          citizen_id?: string | null
          class_name?: string | null
          club_id?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          password_set?: boolean
          position?: Database["public"]["Enums"]["member_position"] | null
          role?: Database["public"]["Enums"]["user_role"]
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          owner_id: string | null
          rejected_reason: string | null
          status: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          owner_id?: string | null
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          owner_id?: string | null
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          locale: string
          p256dh_key: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          locale?: string
          p256dh_key: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          locale?: string
          p256dh_key?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_records: {
        Row: {
          created_at: string
          document_id: string
          id: string
          signature_data: string
          signed_at: string
          signer_id: string | null
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          signature_data: string
          signed_at?: string
          signer_id?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          signature_data?: string
          signed_at?: string
          signer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_records_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_records_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_position: {
        Args: never
        Returns: Database["public"]["Enums"]["member_position"]
      }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_activity_stats: {
        Args: never
        Returns: {
          attendance: number
          completed: number
          month: string
          pending: number
        }[]
      }
      get_citizen_id: { Args: { member_id: string }; Returns: string }
      get_member_stats: {
        Args: never
        Returns: {
          department: string
          member_count: number
        }[]
      }
      get_unread_notification_count: { Args: never; Returns: number }
      list_notifications: {
        Args: { p_limit?: number; p_offset?: number; p_unread_only?: boolean }
        Returns: {
          created_at: string
          id: string
          link: string
          message_key: string
          message_params: Json
          read: boolean
          title: string
          total_count: number
          type: Database["public"]["Enums"]["notification_type"]
        }[]
      }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      notify_roles: {
        Args: {
          p_key: string
          p_link: string
          p_params: Json
          p_roles: Database["public"]["Enums"]["user_role"][]
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
        }
        Returns: undefined
      }
      sign_document: {
        Args: { p_document_id: string; p_signature_data: string }
        Returns: undefined
      }
    }
    Enums: {
      activity_status: "pending" | "completed" | "cancelled"
      book_status: "draft" | "published"
      document_status: "draft" | "signed" | "pending_approval" | "official"
      notification_type:
        | "meeting"
        | "activity"
        | "deadline"
        | "approval"
        | "announcement"
      project_status: "draft" | "teacher_review" | "admin_approval" | "official"
      member_position:
        | "president"
        | "vice_president"
        | "receptionist"
        | "registrar"
        | "public_relations"
        | "secretary"
        | "advisor"
        | "committee"
      user_role:
        | "guest"
        | "pending"
        | "student"
        | "aft"
        | "teacher"
        | "aft_teacher"
        | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_status: ["pending", "completed", "cancelled"],
      book_status: ["draft", "published"],
      document_status: ["draft", "signed", "pending_approval", "official"],
      notification_type: [
        "meeting",
        "activity",
        "deadline",
        "approval",
        "announcement",
      ],
      project_status: ["draft", "teacher_review", "admin_approval", "official"],
      member_position: [
        "president",
        "vice_president",
        "receptionist",
        "registrar",
        "public_relations",
        "secretary",
        "advisor",
        "committee",
      ],
      user_role: [
        "guest",
        "pending",
        "student",
        "aft",
        "teacher",
        "aft_teacher",
        "admin",
      ],
    },
  },
} as const
