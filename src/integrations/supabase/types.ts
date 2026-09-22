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
  public: {
    Tables: {
      clients: {
        Row: {
          billing_address: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          company_name: string | null
          created_at: string
          default_event_address: string | null
          email: string | null
          first_name: string | null
          id: string
          is_demo: boolean
          last_name: string | null
          notes: string | null
          organisation_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          company_name?: string | null
          created_at?: string
          default_event_address?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_demo?: boolean
          last_name?: string | null
          notes?: string | null
          organisation_id?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          company_name?: string | null
          created_at?: string
          default_event_address?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_demo?: boolean
          last_name?: string | null
          notes?: string | null
          organisation_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_dietaries: {
        Row: {
          confirmed: boolean
          created_at: string
          event_id: string
          guest_count: number | null
          id: string
          notes: string | null
          organisation_id: string
          severity: string | null
          type: string
          updated_at: string
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          event_id: string
          guest_count?: number | null
          id?: string
          notes?: string | null
          organisation_id?: string
          severity?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          event_id?: string
          guest_count?: number | null
          id?: string
          notes?: string | null
          organisation_id?: string
          severity?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_dietaries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_dietaries_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          arrival_time: string | null
          budget: number | null
          client_id: string | null
          created_at: string
          cuisine: string | null
          currency: string
          end_time: string | null
          event_date: string | null
          event_type: string | null
          guest_count: number | null
          guest_count_status: Database["public"]["Enums"]["guest_count_status"]
          id: string
          internal_notes: string | null
          is_demo: boolean
          organisation_id: string
          service_style: string | null
          service_time: string | null
          source: Database["public"]["Enums"]["event_source"]
          source_reference: string | null
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
          venue_address: string | null
          venue_contact_name: string | null
          venue_contact_phone: string | null
          venue_name: string | null
        }
        Insert: {
          arrival_time?: string | null
          budget?: number | null
          client_id?: string | null
          created_at?: string
          cuisine?: string | null
          currency?: string
          end_time?: string | null
          event_date?: string | null
          event_type?: string | null
          guest_count?: number | null
          guest_count_status?: Database["public"]["Enums"]["guest_count_status"]
          id?: string
          internal_notes?: string | null
          is_demo?: boolean
          organisation_id?: string
          service_style?: string | null
          service_time?: string | null
          source?: Database["public"]["Enums"]["event_source"]
          source_reference?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_contact_name?: string | null
          venue_contact_phone?: string | null
          venue_name?: string | null
        }
        Update: {
          arrival_time?: string | null
          budget?: number | null
          client_id?: string | null
          created_at?: string
          cuisine?: string | null
          currency?: string
          end_time?: string | null
          event_date?: string | null
          event_type?: string | null
          guest_count?: number | null
          guest_count_status?: Database["public"]["Enums"]["guest_count_status"]
          id?: string
          internal_notes?: string | null
          is_demo?: boolean
          organisation_id?: string
          service_style?: string | null
          service_time?: string | null
          source?: Database["public"]["Enums"]["event_source"]
          source_reference?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
          venue_address?: string | null
          venue_contact_name?: string | null
          venue_contact_phone?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          id: string
          name: string
          organisation_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          organisation_id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          organisation_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_organisation_id: { Args: never; Returns: string }
      load_demo_data: { Args: never; Returns: number }
      remove_demo_data: { Args: never; Returns: undefined }
      setup_organisation: {
        Args: { _org_name: string; _user_name?: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "owner" | "manager" | "staff"
      client_type: "individual" | "corporate" | "agency" | "venue" | "other"
      event_source:
        | "togather"
        | "poptop"
        | "direct"
        | "email"
        | "website"
        | "referral"
        | "repeat_client"
        | "instagram"
        | "whatsapp"
        | "other"
      event_status:
        | "enquiry"
        | "quoting"
        | "awaiting_client"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "lost"
        | "cancelled"
      guest_count_status: "estimated" | "booked" | "confirmed" | "final"
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
  public: {
    Enums: {
      app_role: ["owner", "manager", "staff"],
      client_type: ["individual", "corporate", "agency", "venue", "other"],
      event_source: [
        "togather",
        "poptop",
        "direct",
        "email",
        "website",
        "referral",
        "repeat_client",
        "instagram",
        "whatsapp",
        "other",
      ],
      event_status: [
        "enquiry",
        "quoting",
        "awaiting_client",
        "confirmed",
        "in_progress",
        "completed",
        "lost",
        "cancelled",
      ],
      guest_count_status: ["estimated", "booked", "confirmed", "final"],
    },
  },
} as const
