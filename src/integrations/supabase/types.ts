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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      campaign_deliveries: {
        Row: {
          campaign_id: string
          created_at: string
          delivered_at: string | null
          failed_at: string | null
          id: string
          message_id: string | null
          phone: string
          sent_at: string
          status: string
          status_detail: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          message_id?: string | null
          phone: string
          sent_at?: string
          status?: string
          status_detail?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          message_id?: string | null
          phone?: string
          sent_at?: string
          status?: string
          status_detail?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_deliveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_files: {
        Row: {
          campaign_id: string
          created_at: string
          filename: string
          id: string
          kind: Database["public"]["Enums"]["file_kind"]
          mime: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          filename: string
          id?: string
          kind: Database["public"]["Enums"]["file_kind"]
          mime?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          filename?: string
          id?: string
          kind?: Database["public"]["Enums"]["file_kind"]
          mime?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_files_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          auto_dispatch: boolean
          channel: string
          client_display_name: string | null
          created_at: string
          debit_cents: number
          delivered_count: number | null
          dispatch_error: string | null
          dispatched_at: string | null
          failed_count: number | null
          hygiene_duplicates: number | null
          hygiene_invalid: number | null
          hygiene_total: number | null
          hygiene_valid: number | null
          id: string
          infobip_bulk_id: string | null
          infobip_meta: Json | null
          infobip_template_id: string | null
          link: string | null
          message: string
          name: string
          niche_id: string | null
          paid_at: string | null
          paid_by: string | null
          paid_method: string | null
          payment_reference: string | null
          payment_status: string
          profile_photo_source: string | null
          profile_photo_url: string | null
          refund_cents: number
          scheduled_at: string | null
          send_count: number
          short_link_id: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          template_data: Json | null
          template_id: string | null
          unit_price_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_dispatch?: boolean
          channel?: string
          client_display_name?: string | null
          created_at?: string
          debit_cents: number
          delivered_count?: number | null
          dispatch_error?: string | null
          dispatched_at?: string | null
          failed_count?: number | null
          hygiene_duplicates?: number | null
          hygiene_invalid?: number | null
          hygiene_total?: number | null
          hygiene_valid?: number | null
          id?: string
          infobip_bulk_id?: string | null
          infobip_meta?: Json | null
          infobip_template_id?: string | null
          link?: string | null
          message: string
          name: string
          niche_id?: string | null
          paid_at?: string | null
          paid_by?: string | null
          paid_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          profile_photo_source?: string | null
          profile_photo_url?: string | null
          refund_cents?: number
          scheduled_at?: string | null
          send_count: number
          short_link_id?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          template_data?: Json | null
          template_id?: string | null
          unit_price_cents: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_dispatch?: boolean
          channel?: string
          client_display_name?: string | null
          created_at?: string
          debit_cents?: number
          delivered_count?: number | null
          dispatch_error?: string | null
          dispatched_at?: string | null
          failed_count?: number | null
          hygiene_duplicates?: number | null
          hygiene_invalid?: number | null
          hygiene_total?: number | null
          hygiene_valid?: number | null
          id?: string
          infobip_bulk_id?: string | null
          infobip_meta?: Json | null
          infobip_template_id?: string | null
          link?: string | null
          message?: string
          name?: string
          niche_id?: string | null
          paid_at?: string | null
          paid_by?: string | null
          paid_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          profile_photo_source?: string | null
          profile_photo_url?: string | null
          refund_cents?: number
          scheduled_at?: string | null
          send_count?: number
          short_link_id?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          template_data?: Json | null
          template_id?: string | null
          unit_price_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_infobip_template_id_fkey"
            columns: ["infobip_template_id"]
            isOneToOne: false
            referencedRelation: "wa_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      client_pricing_overrides: {
        Row: {
          created_at: string
          id: string
          niche_id: string
          price_cents: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          niche_id: string
          price_cents: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          niche_id?: string
          price_cents?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_pricing_overrides_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_balances: {
        Row: {
          balance_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount_cents: number
          balance_after_cents: number
          campaign_id: string | null
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Insert: {
          amount_cents: number
          balance_after_cents: number
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Update: {
          amount_cents?: number
          balance_after_cents?: number
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          type?: Database["public"]["Enums"]["tx_type"]
          user_id?: string
        }
        Relationships: []
      }
      landing_plans: {
        Row: {
          active: boolean
          created_at: string
          cta_label: string
          cta_url: string
          description: string | null
          features: string[]
          highlighted: boolean
          id: string
          name: string
          period_label: string | null
          price_label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cta_label?: string
          cta_url?: string
          description?: string | null
          features?: string[]
          highlighted?: boolean
          id?: string
          name: string
          period_label?: string | null
          price_label?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cta_label?: string
          cta_url?: string
          description?: string | null
          features?: string[]
          highlighted?: boolean
          id?: string
          name?: string
          period_label?: string | null
          price_label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          is_fixed: boolean
          name: string
          sort_order: number
          updated_at: string
          variables: Json
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_fixed?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          variables?: Json
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_fixed?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      niches: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          price_cents: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      short_link_urls: {
        Row: {
          created_at: string
          id: string
          short_link_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          short_link_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          short_link_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "short_link_urls_short_link_id_fkey"
            columns: ["short_link_id"]
            isOneToOne: false
            referencedRelation: "short_links"
            referencedColumns: ["id"]
          },
        ]
      }
      short_links: {
        Row: {
          click_count: number
          created_at: string
          id: string
          infobip_template_id: string | null
          is_rotating: boolean
          label: string | null
          last_clicked_at: string | null
          rotation_index: number
          slug: string
          status: string
          target_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          click_count?: number
          created_at?: string
          id?: string
          infobip_template_id?: string | null
          is_rotating?: boolean
          label?: string | null
          last_clicked_at?: string | null
          rotation_index?: number
          slug: string
          status?: string
          target_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          click_count?: number
          created_at?: string
          id?: string
          infobip_template_id?: string | null
          is_rotating?: boolean
          label?: string | null
          last_clicked_at?: string | null
          rotation_index?: number
          slug?: string
          status?: string
          target_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wa_templates: {
        Row: {
          body_text: string
          button_text: string | null
          button_url_pattern: string | null
          category: string
          created_at: string
          created_by: string | null
          footer_text: string | null
          header_text: string | null
          header_type: string | null
          id: string
          infobip_template_id: string | null
          language: string
          last_synced_at: string | null
          name: string
          status: string
          status_reason: string | null
          updated_at: string
        }
        Insert: {
          body_text: string
          button_text?: string | null
          button_url_pattern?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          footer_text?: string | null
          header_text?: string | null
          header_type?: string | null
          id?: string
          infobip_template_id?: string | null
          language?: string
          last_synced_at?: string | null
          name: string
          status?: string
          status_reason?: string | null
          updated_at?: string
        }
        Update: {
          body_text?: string
          button_text?: string | null
          button_url_pattern?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          footer_text?: string | null
          header_text?: string | null
          header_type?: string | null
          id?: string
          infobip_template_id?: string | null
          language?: string
          last_synced_at?: string | null
          name?: string
          status?: string
          status_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bump_short_link_click: {
        Args: { _slug: string }
        Returns: {
          is_rotating: boolean
          status: string
          target: string
        }[]
      }
    }
    Enums: {
      app_permission:
        | "view_all_campaigns"
        | "download_campaign_files"
        | "download_valid_leads"
        | "edit_templates"
        | "manage_pricing"
        | "manage_niches"
        | "manage_users"
        | "view_shortener_admin"
        | "use_hygiene_tool"
        | "customize_profile_photo"
        | "manage_credits"
        | "manage_infobip"
      app_role: "admin" | "operator" | "client" | "super_admin" | "admin_jr"
      campaign_status:
        | "draft"
        | "scheduled"
        | "processing"
        | "completed"
        | "cancelled"
      file_kind: "contacts" | "media" | "report"
      tx_type: "recharge" | "debit" | "refund" | "adjustment"
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
      app_permission: [
        "view_all_campaigns",
        "download_campaign_files",
        "download_valid_leads",
        "edit_templates",
        "manage_pricing",
        "manage_niches",
        "manage_users",
        "view_shortener_admin",
        "use_hygiene_tool",
        "customize_profile_photo",
        "manage_credits",
        "manage_infobip",
      ],
      app_role: ["admin", "operator", "client", "super_admin", "admin_jr"],
      campaign_status: [
        "draft",
        "scheduled",
        "processing",
        "completed",
        "cancelled",
      ],
      file_kind: ["contacts", "media", "report"],
      tx_type: ["recharge", "debit", "refund", "adjustment"],
    },
  },
} as const
