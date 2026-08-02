/**
 * Generated from the live project (hmkciwgzbdszsgnbeakc) after migrations
 * 0001–0012 were applied. Regenerate with:
 *
 *   supabase gen types typescript --linked > types/database.ts
 *
 * `profiles.citizen_id` appears in this type because the column exists, but
 * it is NOT selectable by `authenticated`/`anon` at runtime — see
 * 0005_citizen_id_column_grants.sql. Read it only via `get_citizen_id()`.
 *
 * `attendance`'s `gps_lat`/`gps_lng`/`device_fingerprint`/`browser`/`ip`
 * columns are similarly present in the type but not selectable — see
 * 0008_dashboard_rls.sql. `select("*")` on either table compiles but fails
 * at the database with 42501 for any non-service-role client.
 *
 * `approved_accounts` (0011) is admin-only RLS — no student/teacher/
 * aft_teacher policy exists for it at all.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      activities: {
        Row: {
          academic_year: number | null;
          club_id: string | null;
          created_at: string;
          created_by: string | null;
          department_id: string | null;
          description: string | null;
          ends_at: string | null;
          id: string;
          is_public: boolean;
          location: string | null;
          starts_at: string;
          status: Database["public"]["Enums"]["activity_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          academic_year?: number | null;
          club_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          department_id?: string | null;
          description?: string | null;
          ends_at?: string | null;
          id?: string;
          is_public?: boolean;
          location?: string | null;
          starts_at: string;
          status?: Database["public"]["Enums"]["activity_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          academic_year?: number | null;
          club_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          department_id?: string | null;
          description?: string | null;
          ends_at?: string | null;
          id?: string;
          is_public?: boolean;
          location?: string | null;
          starts_at?: string;
          status?: Database["public"]["Enums"]["activity_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activities_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      approved_accounts: {
        Row: {
          approved_by: string | null;
          created_at: string;
          department_id: string | null;
          email: string;
          id: string;
          note: string | null;
          role: Database["public"]["Enums"]["user_role"];
          student_id: string | null;
        };
        Insert: {
          approved_by?: string | null;
          created_at?: string;
          department_id?: string | null;
          email: string;
          id?: string;
          note?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          student_id?: string | null;
        };
        Update: {
          approved_by?: string | null;
          created_at?: string;
          department_id?: string | null;
          email?: string;
          id?: string;
          note?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          student_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "approved_accounts_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approved_accounts_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance: {
        Row: {
          activity_id: string;
          browser: string | null;
          class_name: string | null;
          created_at: string;
          department_id: string | null;
          device_fingerprint: string | null;
          gps_lat: number | null;
          gps_lng: number | null;
          id: string;
          ip: unknown;
          recorded_at: string;
          room: string | null;
          status: Database["public"]["Enums"]["activity_status"];
          student_id: string;
        };
        Insert: {
          activity_id: string;
          browser?: string | null;
          class_name?: string | null;
          created_at?: string;
          department_id?: string | null;
          device_fingerprint?: string | null;
          gps_lat?: number | null;
          gps_lng?: number | null;
          id?: string;
          ip?: unknown;
          recorded_at?: string;
          room?: string | null;
          status?: Database["public"]["Enums"]["activity_status"];
          student_id: string;
        };
        Update: {
          activity_id?: string;
          browser?: string | null;
          class_name?: string | null;
          created_at?: string;
          department_id?: string | null;
          device_fingerprint?: string | null;
          gps_lat?: number | null;
          gps_lng?: number | null;
          id?: string;
          ip?: unknown;
          recorded_at?: string;
          room?: string | null;
          status?: Database["public"]["Enums"]["activity_status"];
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      clubs: {
        Row: {
          id: string;
          name_en: string;
          name_th: string;
        };
        Insert: {
          id?: string;
          name_en: string;
          name_th: string;
        };
        Update: {
          id?: string;
          name_en?: string;
          name_th?: string;
        };
        Relationships: [];
      };
      departments: {
        Row: {
          code: string;
          id: string;
          name_en: string;
          name_th: string;
        };
        Insert: {
          code: string;
          id?: string;
          name_en: string;
          name_th: string;
        };
        Update: {
          code?: string;
          id?: string;
          name_en?: string;
          name_th?: string;
        };
        Relationships: [];
      };
      document_drafts: {
        Row: {
          content: string | null;
          created_at: string;
          created_by: string | null;
          document_id: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          content?: string | null;
          created_at?: string;
          created_by?: string | null;
          document_id: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          content?: string | null;
          created_at?: string;
          created_by?: string | null;
          document_id?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_drafts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_drafts_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          created_at: string;
          id: string;
          owner_id: string | null;
          status: Database["public"]["Enums"]["document_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          owner_id?: string | null;
          status?: Database["public"]["Enums"]["document_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          owner_id?: string | null;
          status?: Database["public"]["Enums"]["document_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          read: boolean;
          recipient_id: string | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          read?: boolean;
          recipient_id?: string | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          read?: boolean;
          recipient_id?: string | null;
          title?: string;
          type?: Database["public"]["Enums"]["notification_type"];
        };
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          academic_year: number | null;
          citizen_id: string | null;
          class_name: string | null;
          club_id: string | null;
          created_at: string;
          department_id: string | null;
          email: string;
          full_name: string | null;
          id: string;
          role: Database["public"]["Enums"]["user_role"];
          student_id: string | null;
          updated_at: string;
        };
        Insert: {
          academic_year?: number | null;
          citizen_id?: string | null;
          class_name?: string | null;
          club_id?: string | null;
          created_at?: string;
          department_id?: string | null;
          email: string;
          full_name?: string | null;
          id: string;
          role?: Database["public"]["Enums"]["user_role"];
          student_id?: string | null;
          updated_at?: string;
        };
        Update: {
          academic_year?: number | null;
          citizen_id?: string | null;
          class_name?: string | null;
          club_id?: string | null;
          created_at?: string;
          department_id?: string | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["user_role"];
          student_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          created_at: string;
          department_id: string | null;
          description: string | null;
          id: string;
          owner_id: string | null;
          status: Database["public"]["Enums"]["project_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          department_id?: string | null;
          description?: string | null;
          id?: string;
          owner_id?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          department_id?: string | null;
          description?: string | null;
          id?: string;
          owner_id?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_role: {
        Args: Record<string, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      get_activity_stats: {
        Args: Record<string, never>;
        Returns: {
          attendance: number;
          completed: number;
          month: string;
          pending: number;
        }[];
      };
      get_citizen_id: { Args: { member_id: string }; Returns: string };
      get_member_stats: {
        Args: Record<string, never>;
        Returns: {
          department: string;
          member_count: number;
        }[];
      };
    };
    Enums: {
      activity_status: "pending" | "completed" | "cancelled";
      document_status: "draft" | "signed" | "pending_approval" | "official";
      notification_type:
        | "meeting"
        | "activity"
        | "deadline"
        | "approval"
        | "announcement";
      project_status: "draft" | "teacher_review" | "admin_approval" | "official";
      user_role: "guest" | "student" | "teacher" | "aft_teacher" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      activity_status: ["pending", "completed", "cancelled"],
      document_status: ["draft", "signed", "pending_approval", "official"],
      notification_type: [
        "meeting",
        "activity",
        "deadline",
        "approval",
        "announcement",
      ],
      project_status: ["draft", "teacher_review", "admin_approval", "official"],
      user_role: ["guest", "student", "teacher", "aft_teacher", "admin"],
    },
  },
} as const;
