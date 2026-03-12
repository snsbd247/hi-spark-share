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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_login_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "admin_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_login_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          admin_name: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          tenant_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          admin_name?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          tenant_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          admin_name?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_logs: {
        Row: {
          backup_type: string
          created_at: string
          created_by: string
          error_message: string | null
          file_name: string
          file_size: number
          id: string
          status: string
          tenant_id: string | null
        }
        Insert: {
          backup_type?: string
          created_at?: string
          created_by: string
          error_message?: string | null
          file_name: string
          file_size?: number
          id?: string
          status?: string
          tenant_id?: string | null
        }
        Update: {
          backup_type?: string
          created_at?: string
          created_by?: string
          error_message?: string | null
          file_name?: string
          file_size?: number
          id?: string
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backup_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "bills_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          created_at: string
          db_role: Database["public"]["Enums"]["app_role"]
          description: string | null
          id: string
          is_system: boolean
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          db_role?: Database["public"]["Enums"]["app_role"]
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          db_role?: Database["public"]["Enums"]["app_role"]
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "customer_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_sessions: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          session_token: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at?: string
          id?: string
          session_token: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          session_token?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          permanent_address: string | null
          phone: string
          photo_url: string | null
          pop_location: string | null
          pppoe_password: string | null
          pppoe_password_hash: string | null
          pppoe_username: string | null
          road: string | null
          router_id: string | null
          router_mac: string | null
          status: string
          subnet: string | null
          tenant_id: string | null
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
          permanent_address?: string | null
          phone: string
          photo_url?: string | null
          pop_location?: string | null
          pppoe_password?: string | null
          pppoe_password_hash?: string | null
          pppoe_username?: string | null
          road?: string | null
          router_id?: string | null
          router_mac?: string | null
          status?: string
          subnet?: string | null
          tenant_id?: string | null
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
          permanent_address?: string | null
          phone?: string
          photo_url?: string | null
          pop_location?: string | null
          pppoe_password?: string | null
          pppoe_password_hash?: string | null
          pppoe_username?: string | null
          road?: string | null
          router_id?: string | null
          router_mac?: string | null
          status?: string
          subnet?: string | null
          tenant_id?: string | null
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
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "general_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "merchant_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "mikrotik_routers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "olts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "onus_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "packages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateways: {
        Row: {
          app_key: string | null
          app_secret: string | null
          base_url: string | null
          created_at: string
          environment: string
          gateway_name: string
          id: string
          last_connected_at: string | null
          merchant_number: string | null
          password: string | null
          status: string
          tenant_id: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          app_key?: string | null
          app_secret?: string | null
          base_url?: string | null
          created_at?: string
          environment?: string
          gateway_name?: string
          id?: string
          last_connected_at?: string | null
          merchant_number?: string | null
          password?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          app_key?: string | null
          app_secret?: string | null
          base_url?: string | null
          created_at?: string
          environment?: string
          gateway_name?: string
          id?: string
          last_connected_at?: string | null
          merchant_number?: string | null
          password?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateways_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          description: string | null
          id: string
          module: string
          tenant_id: string | null
        }
        Insert: {
          action: string
          description?: string | null
          id?: string
          module: string
          tenant_id?: string | null
        }
        Update: {
          action?: string
          description?: string | null
          id?: string
          module?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
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
          password_hash: string | null
          staff_id: string | null
          status: string
          tenant_id: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          mobile?: string | null
          password_hash?: string | null
          staff_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          mobile?: string | null
          password_hash?: string | null
          staff_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "reminder_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          id: string
          permission_id: string
          role_id: string
          tenant_id: string | null
        }
        Insert: {
          id?: string
          permission_id: string
          role_id: string
          tenant_id?: string | null
        }
        Update: {
          id?: string
          permission_id?: string
          role_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
          whatsapp_phone_id?: string | null
          whatsapp_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          created_at: string
          id: string
          message: string
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean
          max_customers: number
          max_users: number
          monthly_price: number
          name: string
          updated_at: string
          yearly_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          max_customers?: number
          max_users?: number
          monthly_price?: number
          name: string
          updated_at?: string
          yearly_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          max_customers?: number
          max_users?: number
          monthly_price?: number
          name?: string
          updated_at?: string
          yearly_price?: number
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tenant_subscriptions: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          plan_id: string
          start_date: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          plan_id: string
          start_date?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          plan_id?: string
          start_date?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          company_name: string
          contact_email: string | null
          created_at: string
          id: string
          logo_url: string | null
          max_customers: number | null
          status: string
          subdomain: string
          updated_at: string
        }
        Insert: {
          company_name: string
          contact_email?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          max_customers?: number | null
          status?: string
          subdomain: string
          updated_at?: string
        }
        Update: {
          company_name?: string
          contact_email?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          max_customers?: number | null
          status?: string
          subdomain?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_replies: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_name: string
          sender_type: string
          tenant_id: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_name: string
          sender_type?: string
          tenant_id?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_name?: string
          sender_type?: string
          tenant_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
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
          custom_role_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          custom_role_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          custom_role_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          address: string | null
          area_name: string
          created_at: string
          id: string
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          area_name: string
          created_at?: string
          id?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          area_name?: string
          created_at?: string
          id?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "staff"
        | "manager"
        | "operator"
        | "technician"
        | "accountant"
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
      app_role: [
        "super_admin",
        "admin",
        "staff",
        "manager",
        "operator",
        "technician",
        "accountant",
      ],
    },
  },
} as const
