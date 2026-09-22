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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: number
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: never
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: never
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          joined_at: string
          left_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          left_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          type: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          type?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          type?: string
        }
        Relationships: []
      }
      journey_links: {
        Row: {
          added_by: string | null
          created_at: string
          id: number
          journey_id: string
          kind: string
          title: string
          url: string
          visibility: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: never
          journey_id: string
          kind: string
          title: string
          url: string
          visibility?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: never
          journey_id?: string
          kind?: string
          title?: string
          url?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_links_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_links_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_members: {
        Row: {
          created_at: string
          invited_by: string | null
          joined_at: string | null
          journey_id: string
          left_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          joined_at?: string | null
          journey_id: string
          left_at?: string | null
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          joined_at?: string | null
          journey_id?: string
          left_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_members_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journeys: {
        Row: {
          archived_at: string | null
          conversation_id: string
          created_at: string
          created_by: string | null
          goal: string | null
          id: string
          name: string
        }
        Insert: {
          archived_at?: string | null
          conversation_id: string
          created_at?: string
          created_by?: string | null
          goal?: string | null
          id?: string
          name: string
        }
        Update: {
          archived_at?: string | null
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          goal?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "journeys_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journeys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          unmatched_at: string | null
          unmatched_by: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          unmatched_at?: string | null
          unmatched_by?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          unmatched_at?: string | null
          unmatched_by?: string | null
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_unmatched_by_fkey"
            columns: ["unmatched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: number
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: never
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: never
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_categories: {
        Row: {
          category_id: number
          profile_id: string
        }
        Insert: {
          category_id: number
          profile_id: string
        }
        Update: {
          category_id?: number
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_categories_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_skills: {
        Row: {
          kind: string
          profile_id: string
          skill_id: number
        }
        Insert: {
          kind: string
          profile_id: string
          skill_id: number
        }
        Update: {
          kind?: string
          profile_id?: string
          skill_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_skills_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ambitions: string[] | null
          avatar_path: string | null
          city: string | null
          country: string | null
          created_at: string
          display_name: string | null
          district: string | null
          id: string
          idea_statuses: string[] | null
          is_demo: boolean
          last_seen_at: string | null
          onboarded: boolean
          open_to_partners: boolean
          page_views: number
          partner_weekly_hours: string[] | null
          pitch: string | null
          postal_code: string | null
          search_indexable: boolean
          slug: string | null
          updated_at: string
          visibility: string | null
          weekly_hours: string[] | null
          work_modes: string[] | null
        }
        Insert: {
          ambitions?: string[] | null
          avatar_path?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          district?: string | null
          id: string
          idea_statuses?: string[] | null
          is_demo?: boolean
          last_seen_at?: string | null
          onboarded?: boolean
          open_to_partners?: boolean
          page_views?: number
          partner_weekly_hours?: string[] | null
          pitch?: string | null
          postal_code?: string | null
          search_indexable?: boolean
          slug?: string | null
          updated_at?: string
          visibility?: string | null
          weekly_hours?: string[] | null
          work_modes?: string[] | null
        }
        Update: {
          ambitions?: string[] | null
          avatar_path?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          district?: string | null
          id?: string
          idea_statuses?: string[] | null
          is_demo?: boolean
          last_seen_at?: string | null
          onboarded?: boolean
          open_to_partners?: boolean
          page_views?: number
          partner_weekly_hours?: string[] | null
          pitch?: string | null
          postal_code?: string | null
          search_indexable?: boolean
          slug?: string | null
          updated_at?: string
          visibility?: string | null
          weekly_hours?: string[] | null
          work_modes?: string[] | null
        }
        Relationships: []
      }
      project_links: {
        Row: {
          created_at: string
          id: number
          label: string
          project_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: never
          label: string
          project_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: never
          label?: string
          project_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          category_id: number
          created_at: string
          ended_on: string | null
          hours_per_week: string | null
          id: string
          lessons: string
          name: string
          outcome: string
          owner_id: string
          role: string | null
          siret: string | null
          started_on: string
          updated_at: string
          visibility: string
        }
        Insert: {
          category_id: number
          created_at?: string
          ended_on?: string | null
          hours_per_week?: string | null
          id?: string
          lessons: string
          name: string
          outcome: string
          owner_id: string
          role?: string | null
          siret?: string | null
          started_on: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          category_id?: number
          created_at?: string
          ended_on?: string | null
          hours_per_week?: string | null
          id?: string
          lessons?: string
          name?: string
          outcome?: string
          owner_id?: string
          role?: string | null
          siret?: string | null
          started_on?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
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
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: number
          reason: string
          reported_id: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: never
          reason: string
          reported_id: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: never
          reason?: string
          reported_id?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_id_fkey"
            columns: ["reported_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category_id: number | null
          id: number
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          category_id?: number | null
          id?: never
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          category_id?: number | null
          id?: never
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      swipes: {
        Row: {
          created_at: string
          direction: string
          swiper_id: string
          target_id: string
        }
        Insert: {
          created_at?: string
          direction: string
          swiper_id: string
          target_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          swiper_id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swipes_swiper_id_fkey"
            columns: ["swiper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swipes_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_reports: {
        Row: {
          created_at: string | null
          details: string | null
          id: number | null
          reason: string | null
          reported_email: string | null
          reported_id: string | null
          reported_name: string | null
          reporter_email: string | null
          reporter_id: string | null
          reporter_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_id_fkey"
            columns: ["reported_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_active_profiles: {
        Row: {
          active_profiles_30d: number | null
          region: string | null
        }
        Relationships: []
      }
      metrics_project_adoption: {
        Row: {
          pct_with_a_project: number | null
          signup_week: string | null
          signup_week_start: string | null
          signups: number | null
          with_a_project: number | null
        }
        Relationships: []
      }
      metrics_public_pages: {
        Row: {
          public_profiles: number | null
          total_page_views: number | null
        }
        Relationships: []
      }
      metrics_retention_30d: {
        Row: {
          retention_pct: number | null
          seen_after_30d: number | null
          signup_week: string | null
          signup_week_start: string | null
          signups: number | null
        }
        Relationships: []
      }
      metrics_weekly_matches: {
        Row: {
          iso_week: string | null
          new_matches: number | null
          week_start: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      archive_journey_if_too_small: {
        Args: { p_journey_id: string }
        Returns: undefined
      }
      can_write_conversation: { Args: { conv: string }; Returns: boolean }
      department_of: { Args: { postal_code: string }; Returns: string }
      get_blocked_profiles: {
        Args: never
        Returns: {
          avatar_path: string
          blocked_at: string
          display_name: string
          id: string
        }[]
      }
      get_feed: {
        Args: never
        Returns: {
          ambitions: string[]
          avatar_path: string
          category_names: string[]
          city: string
          country: string
          display_name: string
          district: string
          id: string
          idea_statuses: string[]
          offers: string[]
          partner_weekly_hours: string[]
          pitch: string
          seeks: string[]
          weekly_hours: string[]
          work_modes: string[]
        }[]
      }
      get_my_postal_code: { Args: never; Returns: string }
      get_public_profile: {
        Args: { p_slug: string }
        Returns: {
          avatar_path: string
          category_names: string[]
          city: string
          country: string
          display_name: string
          offers: string[]
          open_to_partners: boolean
          search_indexable: boolean
          seeks: string[]
        }[]
      }
      get_public_projects: {
        Args: { p_slug: string }
        Returns: {
          category_name: string
          ended_on: string
          id: string
          lessons: string
          links: Json
          name: string
          outcome: string
          role: string
          started_on: string
        }[]
      }
      increment_page_view: { Args: { p_slug: string }; Returns: undefined }
      invite_to_journey: {
        Args: { p_journey_id: string; p_user_id: string }
        Returns: undefined
      }
      is_blocked: { Args: { a: string; b: string }; Returns: boolean }
      is_conversation_reader: { Args: { conv: string }; Returns: boolean }
      is_journey_invitee: { Args: { j: string }; Returns: boolean }
      is_journey_member: { Args: { j: string }; Returns: boolean }
      is_match_partner: { Args: { other_user: string }; Returns: boolean }
      is_open_journey_member: { Args: { j: string }; Returns: boolean }
      leave_journey: { Args: { p_journey_id: string }; Returns: undefined }
      local_zone: {
        Args: { city: string; country: string; postal_code: string }
        Returns: string
      }
      normalize_place: { Args: { place: string }; Returns: string }
      portfolio_visible_to: {
        Args: { p_owner_id: string; p_visibility: string }
        Returns: boolean
      }
      respond_to_journey_invite: {
        Args: { p_accept: boolean; p_journey_id: string }
        Returns: undefined
      }
      start_journey: {
        Args: { p_goal: string; p_match_id: string; p_name: string }
        Returns: string
      }
      touch_last_seen: { Args: never; Returns: undefined }
      unmatch: { Args: { p_match_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
