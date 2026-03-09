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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_login_logs: {
        Row: {
          action: string
          admin_id: string
          browser: string | null
          created_at: string
          device_name: string | null
          id: string
          ip_address: string | null
          session_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          browser?: string | null
          created_at?: string
          device_name?: string | null
          id?: string
          ip_address?: string | null
          session_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          browser?: string | null
          created_at?: string
          device_name?: string | null
          id?: string
          ip_address?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_login_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "admin_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_sessions: {
        Row: {
          admin_id: string
          browser: string
          created_at: string
          device_name: string
          id: string
          ip_address: string
          session_token: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          browser?: string
          created_at?: string
          device_name?: string
          id?: string
          ip_address?: string
          session_token: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          browser?: string
          created_at?: string
          device_name?: string
          id?: string
          ip_address?: string
          session_token?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      bills: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          due_date: string | null
          id: string
          month: string
          paid_date: string | null
          payment_link_token: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_id: string
          due_date?: string | null
          id?: string
          month: string
          paid_date?: string | null
          payment_link_token?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          due_date?: string | null
          id?: string
          month?: string
          paid_date?: string | null
          payment_link_token?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_ledger: {
        Row: {
          balance: number
          created_at: string
          credit: number
          customer_id: string
          date: string
          debit: number
          description: string
          id: string
          reference: string | null
          type: string
        }
        Insert: {
          balance?: number
          created_at?: string
          credit?: number
          customer_id: string
          date?: string
          debit?: number
          description: string
          id?: string
          reference?: string | null
          type?: string
        }
        Update: {
          balance?: number
          created_at?: string
          credit?: number
          customer_id?: string
          date?: string
          debit?: number
          description?: string
          id?: string
          reference?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          alt_phone: string | null
          area: string
          box_name: string | null
          cable_length: string | null
          city: string | null
          connection_status: string
          connectivity_fee: number | null
          created_at: string
          customer_id: string
          discount: number | null
          due_date_day: number | null
          email: string | null
          father_name: string | null
          gateway: string | null
          house: string | null
          id: string
          installation_date: string | null
          installed_by: string | null
          ip_address: string | null
          mikrotik_sync_status: string
          monthly_bill: number
          mother_name: string | null
          name: string
          nid: string | null
          occupation: string | null
          onu_mac: string | null
          package_id: string | null
          password: string | null
          permanent_address: string | null
          phone: string
          photo_url: string | null
          pop_location: string | null
          pppoe_password: string | null
          pppoe_username: string | null
          road: string | null
          router_id: string | null
          router_mac: string | null
          status: string
          subnet: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          alt_phone?: string | null
          area: string
          box_name?: string | null
          cable_length?: string | null
          city?: string | null
          connection_status?: string
          connectivity_fee?: number | null
          created_at?: string
          customer_id: string
          discount?: number | null
          due_date_day?: number | null
          email?: string | null
          father_name?: string | null
          gateway?: string | null
          house?: string | null
          id?: string
          installation_date?: string | null
          installed_by?: string | null
          ip_address?: string | null
          mikrotik_sync_status?: string
          monthly_bill?: number
          mother_name?: string | null
          name: string
          nid?: string | null
          occupation?: string | null
          onu_mac?: string | null
          package_id?: string | null
          password?: string | null
          permanent_address?: string | null
          phone: string
          photo_url?: string | null
          pop_location?: string | null
          pppoe_password?: string | null
          pppoe_username?: string | null
          road?: string | null
          router_id?: string | null
          router_mac?: string | null
          status?: string
          subnet?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          alt_phone?: string | null
          area?: string
          box_name?: string | null
          cable_length?: string | null
          city?: string | null
          connection_status?: string
          connectivity_fee?: number | null
          created_at?: string
          customer_id?: string
          discount?: number | null
          due_date_day?: number | null
          email?: string | null
          father_name?: string | null
          gateway?: string | null
          house?: string | null
          id?: string
          installation_date?: string | null
          installed_by?: string | null
          ip_address?: string | null
          mikrotik_sync_status?: string
          monthly_bill?: number
          mother_name?: string | null
          name?: string
          nid?: string | null
          occupation?: string | null
          onu_mac?: string | null
          package_id?: string | null
          password?: string | null
          permanent_address?: string | null
          phone?: string
          photo_url?: string | null
          pop_location?: string | null
          pppoe_password?: string | null
          pppoe_username?: string | null
          road?: string | null
          router_id?: string | null
          router_mac?: string | null
          status?: string
          subnet?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_router_id_fkey"
            columns: ["router_id"]
            isOneToOne: false
            referencedRelation: "mikrotik_routers"
            referencedColumns: ["id"]
          },
        ]
      }
      general_settings: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          mobile: string | null
          site_name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          mobile?: string | null
          site_name?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          mobile?: string | null
          site_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      merchant_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          matched_bill_id: string | null
          matched_customer_id: string | null
          notes: string | null
          payment_date: string
          reference: string | null
          sender_phone: string
          sms_text: string | null
          status: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          matched_bill_id?: string | null
          matched_customer_id?: string | null
          notes?: string | null
          payment_date?: string
          reference?: string | null
          sender_phone: string
          sms_text?: string | null
          status?: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          matched_bill_id?: string | null
          matched_customer_id?: string | null
          notes?: string | null
          payment_date?: string
          reference?: string | null
          sender_phone?: string
          sms_text?: string | null
          status?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payments_matched_bill_id_fkey"
            columns: ["matched_bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_payments_matched_customer_id_fkey"
            columns: ["matched_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      mikrotik_routers: {
        Row: {
          api_port: number
          created_at: string
          description: string | null
          id: string
          ip_address: string
          name: string
          password: string
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          api_port?: number
          created_at?: string
          description?: string | null
          id?: string
          ip_address: string
          name: string
          password: string
          status?: string
          updated_at?: string
          username?: string
        }
        Update: {
          api_port?: number
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string
          name?: string
          password?: string
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      olts: {
        Row: {
          brand: string | null
          created_at: string
          id: string
          ip_address: string
          is_active: boolean
          location: string | null
          name: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          id?: string
          ip_address: string
          is_active?: boolean
          location?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          id?: string
          ip_address?: string
          is_active?: boolean
          location?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      onus: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          mac_address: string | null
          olt_id: string | null
          olt_port: string | null
          serial_number: string
          signal_strength: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          mac_address?: string | null
          olt_id?: string | null
          olt_port?: string | null
          serial_number: string
          signal_strength?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          mac_address?: string | null
          olt_id?: string | null
          olt_port?: string | null
          serial_number?: string
          signal_strength?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onus_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onus_olt_id_fkey"
            columns: ["olt_id"]
            isOneToOne: false
            referencedRelation: "olts"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          bandwidth_profile: string | null
          burst_limit: string | null
          created_at: string
          download_speed: number
          id: string
          is_active: boolean
          mikrotik_profile_name: string | null
          monthly_price: number
          name: string
          router_id: string | null
          speed: string
          updated_at: string
          upload_speed: number
        }
        Insert: {
          bandwidth_profile?: string | null
          burst_limit?: string | null
          created_at?: string
          download_speed?: number
          id?: string
          is_active?: boolean
          mikrotik_profile_name?: string | null
          monthly_price?: number
          name: string
          router_id?: string | null
          speed: string
          updated_at?: string
          upload_speed?: number
        }
        Update: {
          bandwidth_profile?: string | null
          burst_limit?: string | null
          created_at?: string
          download_speed?: number
          id?: string
          is_active?: boolean
          mikrotik_profile_name?: string | null
          monthly_price?: number
          name?: string
          router_id?: string | null
          speed?: string
          updated_at?: string
          upload_speed?: number
        }
        Relationships: [
          {
            foreignKeyName: "packages_router_id_fkey"
            columns: ["router_id"]
            isOneToOne: false
            referencedRelation: "mikrotik_routers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bill_id: string | null
          bkash_payment_id: string | null
          bkash_trx_id: string | null
          created_at: string
          customer_id: string
          id: string
          month: string | null
          paid_at: string
          payment_method: string
          status: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          bill_id?: string | null
          bkash_payment_id?: string | null
          bkash_trx_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          month?: string | null
          paid_at?: string
          payment_method?: string
          status?: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string | null
          bkash_payment_id?: string | null
          bkash_trx_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          month?: string | null
          paid_at?: string
          payment_method?: string
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          mobile: string | null
          staff_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          mobile?: string | null
          staff_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          mobile?: string | null
          staff_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      reminder_logs: {
        Row: {
          bill_id: string | null
          channel: string
          created_at: string
          customer_id: string | null
          id: string
          message: string
          phone: string
          status: string
        }
        Insert: {
          bill_id?: string | null
          channel?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          message: string
          phone: string
          status?: string
        }
        Update: {
          bill_id?: string | null
          channel?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          message?: string
          phone?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          message: string
          phone: string
          response: string | null
          sms_type: string
          status: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          message: string
          phone: string
          response?: string | null
          sms_type: string
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          message?: string
          phone?: string
          response?: string | null
          sms_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_settings: {
        Row: {
          api_token: string | null
          id: string
          sender_id: string | null
          sms_on_bill_generate: boolean | null
          sms_on_payment: boolean | null
          sms_on_registration: boolean | null
          sms_on_suspension: boolean | null
          updated_at: string
          whatsapp_enabled: boolean | null
          whatsapp_phone_id: string | null
          whatsapp_token: string | null
        }
        Insert: {
          api_token?: string | null
          id?: string
          sender_id?: string | null
          sms_on_bill_generate?: boolean | null
          sms_on_payment?: boolean | null
          sms_on_registration?: boolean | null
          sms_on_suspension?: boolean | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
          whatsapp_phone_id?: string | null
          whatsapp_token?: string | null
        }
        Update: {
          api_token?: string | null
          id?: string
          sender_id?: string | null
          sms_on_bill_generate?: boolean | null
          sms_on_payment?: boolean | null
          sms_on_registration?: boolean | null
          sms_on_suspension?: boolean | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
          whatsapp_phone_id?: string | null
          whatsapp_token?: string | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          customer_id: string
          id: string
          priority: string
          status: string
          subject: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          customer_id: string
          id?: string
          priority?: string
          status?: string
          subject: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          customer_id?: string
          id?: string
          priority?: string
          status?: string
          subject?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_replies: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_name: string
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_name: string
          sender_type?: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_name?: string
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      zones: {
        Row: {
          address: string | null
          area_name: string
          created_at: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          area_name: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          area_name?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "staff"
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
      app_role: ["super_admin", "admin", "staff"],
    },
  },
} as const
