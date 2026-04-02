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
      accounts: {
        Row: {
          balance: number
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          level: number | null
          name: string
          parent_id: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          balance?: number
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          level?: number | null
          name: string
          parent_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          level?: number | null
          name?: string
          parent_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          description: string
          id: string
          ip_address: string | null
          metadata: Json | null
          module: string
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          module: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          module?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
          city: string | null
          country: string | null
          created_at: string
          device_name: string
          id: string
          ip_address: string
          last_activity: string | null
          session_token: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          browser?: string
          city?: string | null
          country?: string | null
          created_at?: string
          device_name?: string
          id?: string
          ip_address?: string
          last_activity?: string | null
          session_token: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          browser?: string
          city?: string | null
          country?: string | null
          created_at?: string
          device_name?: string
          id?: string
          ip_address?: string
          last_activity?: string | null
          session_token?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          notes: string | null
          status: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date: string
          employee_id: string
          id?: string
          notes?: string | null
          status?: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
          ip_address: string | null
          module: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          admin_name?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          module?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          admin_name?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          module?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
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
        }
        Relationships: []
      }
      billing_config: {
        Row: {
          config_key: string
          config_value: string
          created_at: string
          description: string | null
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value: string
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      bills: {
        Row: {
          amount: number
          coupon_id: string | null
          created_at: string
          customer_id: string
          discount: number
          due_date: string | null
          id: string
          month: string
          paid_amount: number
          paid_date: string | null
          payment_link_token: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          coupon_id?: string | null
          created_at?: string
          customer_id: string
          discount?: number
          due_date?: string | null
          id?: string
          month: string
          paid_amount?: number
          paid_date?: string | null
          payment_link_token?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          coupon_id?: string | null
          created_at?: string
          customer_id?: string
          discount?: number
          due_date?: string | null
          id?: string
          month?: string
          paid_amount?: number
          paid_date?: string | null
          payment_link_token?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          updated_at: string
          used_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      custom_roles: {
        Row: {
          created_at: string
          db_role: Database["public"]["Enums"]["app_role"]
          description: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          db_role?: Database["public"]["Enums"]["app_role"]
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          db_role?: Database["public"]["Enums"]["app_role"]
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_devices: {
        Row: {
          assigned_at: string | null
          created_at: string
          customer_id: string | null
          id: string
          ip_address: string | null
          mac_address: string | null
          notes: string | null
          product_id: string | null
          serial_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          ip_address?: string | null
          mac_address?: string | null
          notes?: string | null
          product_id?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          ip_address?: string | null
          mac_address?: string | null
          notes?: string | null
          product_id?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_devices_customer_id_fkey"
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
      customer_sessions: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          session_token: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at?: string
          id?: string
          session_token: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          session_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_sessions_customer_id_fkey"
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
          district: string | null
          division: string | null
          due_date_day: number | null
          email: string | null
          father_name: string | null
          gateway: string | null
          house: string | null
          id: string
          installation_date: string | null
          installed_by: string | null
          ip_address: string | null
          mac_address: string | null
          mikrotik_sync_status: string
          monthly_bill: number
          mother_name: string | null
          name: string
          nid: string | null
          occupation: string | null
          onu_mac: string | null
          package_id: string | null
          perm_district: string | null
          perm_division: string | null
          perm_house: string | null
          perm_post_office: string | null
          perm_road: string | null
          perm_upazila: string | null
          perm_village: string | null
          permanent_address: string | null
          phone: string
          photo_url: string | null
          pop_location: string | null
          post_office: string | null
          pppoe_password: string | null
          pppoe_password_hash: string | null
          pppoe_username: string | null
          road: string | null
          router_id: string | null
          router_mac: string | null
          static_ip: string | null
          status: string
          subnet: string | null
          upazila: string | null
          updated_at: string
          username: string | null
          village: string | null
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
          district?: string | null
          division?: string | null
          due_date_day?: number | null
          email?: string | null
          father_name?: string | null
          gateway?: string | null
          house?: string | null
          id?: string
          installation_date?: string | null
          installed_by?: string | null
          ip_address?: string | null
          mac_address?: string | null
          mikrotik_sync_status?: string
          monthly_bill?: number
          mother_name?: string | null
          name: string
          nid?: string | null
          occupation?: string | null
          onu_mac?: string | null
          package_id?: string | null
          perm_district?: string | null
          perm_division?: string | null
          perm_house?: string | null
          perm_post_office?: string | null
          perm_road?: string | null
          perm_upazila?: string | null
          perm_village?: string | null
          permanent_address?: string | null
          phone: string
          photo_url?: string | null
          pop_location?: string | null
          post_office?: string | null
          pppoe_password?: string | null
          pppoe_password_hash?: string | null
          pppoe_username?: string | null
          road?: string | null
          router_id?: string | null
          router_mac?: string | null
          static_ip?: string | null
          status?: string
          subnet?: string | null
          upazila?: string | null
          updated_at?: string
          username?: string | null
          village?: string | null
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
          district?: string | null
          division?: string | null
          due_date_day?: number | null
          email?: string | null
          father_name?: string | null
          gateway?: string | null
          house?: string | null
          id?: string
          installation_date?: string | null
          installed_by?: string | null
          ip_address?: string | null
          mac_address?: string | null
          mikrotik_sync_status?: string
          monthly_bill?: number
          mother_name?: string | null
          name?: string
          nid?: string | null
          occupation?: string | null
          onu_mac?: string | null
          package_id?: string | null
          perm_district?: string | null
          perm_division?: string | null
          perm_house?: string | null
          perm_post_office?: string | null
          perm_road?: string | null
          perm_upazila?: string | null
          perm_village?: string | null
          permanent_address?: string | null
          phone?: string
          photo_url?: string | null
          pop_location?: string | null
          post_office?: string | null
          pppoe_password?: string | null
          pppoe_password_hash?: string | null
          pppoe_username?: string | null
          road?: string | null
          router_id?: string | null
          router_mac?: string | null
          static_ip?: string | null
          status?: string
          subnet?: string | null
          upazila?: string | null
          updated_at?: string
          username?: string | null
          village?: string | null
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
      daily_reports: {
        Row: {
          created_at: string
          date: string
          id: string
          new_customers: number
          notes: string | null
          total_billed: number
          total_collection: number
          total_expense: number
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          new_customers?: number
          notes?: string | null
          total_billed?: number
          total_collection?: number
          total_expense?: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          new_customers?: number
          notes?: string | null
          total_billed?: number
          total_collection?: number
          total_expense?: number
        }
        Relationships: []
      }
      designations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      domains: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          is_primary: boolean | null
          is_verified: boolean | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id?: string
          is_primary?: boolean | null
          is_verified?: boolean | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          is_primary?: boolean | null
          is_verified?: boolean | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_education: {
        Row: {
          board_university: string | null
          created_at: string
          degree: string
          employee_id: string
          id: string
          institution: string
          passing_year: string | null
          result: string | null
        }
        Insert: {
          board_university?: string | null
          created_at?: string
          degree: string
          employee_id: string
          id?: string
          institution: string
          passing_year?: string | null
          result?: string | null
        }
        Update: {
          board_university?: string | null
          created_at?: string
          degree?: string
          employee_id?: string
          id?: string
          institution?: string
          passing_year?: string | null
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_education_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_emergency_contacts: {
        Row: {
          address: string | null
          contact_name: string
          created_at: string
          employee_id: string
          id: string
          phone: string
          relation: string
        }
        Insert: {
          address?: string | null
          contact_name: string
          created_at?: string
          employee_id: string
          id?: string
          phone: string
          relation: string
        }
        Update: {
          address?: string | null
          contact_name?: string
          created_at?: string
          employee_id?: string
          id?: string
          phone?: string
          relation?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_emergency_contacts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_experience: {
        Row: {
          company_name: string
          created_at: string
          designation: string
          employee_id: string
          from_date: string | null
          id: string
          responsibilities: string | null
          to_date: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          designation: string
          employee_id: string
          from_date?: string | null
          id?: string
          responsibilities?: string | null
          to_date?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          designation?: string
          employee_id?: string
          from_date?: string | null
          id?: string
          responsibilities?: string | null
          to_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_experience_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_provident_fund: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string | null
          employee_id: string
          employee_share: number
          employer_share: number
          id: string
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          employee_id: string
          employee_share?: number
          employer_share?: number
          id?: string
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          employee_id?: string
          employee_share?: number
          employer_share?: number
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_provident_fund_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salary_structure: {
        Row: {
          basic_salary: number
          conveyance: number
          created_at: string
          effective_from: string
          employee_id: string
          house_rent: number
          id: string
          medical: number
          other_allowance: number
          updated_at: string
        }
        Insert: {
          basic_salary?: number
          conveyance?: number
          created_at?: string
          effective_from?: string
          employee_id: string
          house_rent?: number
          id?: string
          medical?: number
          other_allowance?: number
          updated_at?: string
        }
        Update: {
          basic_salary?: number
          conveyance?: number
          created_at?: string
          effective_from?: string
          employee_id?: string
          house_rent?: number
          id?: string
          medical?: number
          other_allowance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_salary_structure_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_savings_fund: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string | null
          employee_id: string
          id: string
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          employee_id: string
          id?: string
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          employee_id?: string
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_savings_fund_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          created_at: string
          designation_id: string | null
          email: string | null
          employee_id: string
          id: string
          joining_date: string | null
          name: string
          nid: string | null
          phone: string | null
          salary: number
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          designation_id?: string | null
          email?: string | null
          employee_id: string
          id?: string
          joining_date?: string | null
          name: string
          nid?: string | null
          phone?: string | null
          salary?: number
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          designation_id?: string | null
          email?: string | null
          employee_id?: string
          id?: string
          joining_date?: string | null
          name?: string
          nid?: string | null
          phone?: string | null
          salary?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_heads: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          created_at: string
          date: string
          description: string | null
          id: string
          payment_method: string
          reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          payment_method?: string
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          payment_method?: string
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          category: string | null
          created_at: string
          id: string
          is_published: boolean
          question: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          question: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          question?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      general_settings: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          favicon_url: string | null
          id: string
          login_logo_url: string | null
          logo_url: string | null
          mobile: string | null
          primary_color: string | null
          site_name: string
          support_email: string | null
          support_phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          favicon_url?: string | null
          id?: string
          login_logo_url?: string | null
          logo_url?: string | null
          mobile?: string | null
          primary_color?: string | null
          site_name?: string
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          favicon_url?: string | null
          id?: string
          login_logo_url?: string | null
          logo_url?: string | null
          mobile?: string | null
          primary_color?: string | null
          site_name?: string
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      geo_districts: {
        Row: {
          bn_name: string | null
          created_at: string
          division_id: string
          id: string
          name: string
          status: string
        }
        Insert: {
          bn_name?: string | null
          created_at?: string
          division_id: string
          id?: string
          name: string
          status?: string
        }
        Update: {
          bn_name?: string | null
          created_at?: string
          division_id?: string
          id?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_districts_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "geo_divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_divisions: {
        Row: {
          bn_name: string | null
          created_at: string
          id: string
          name: string
          status: string
        }
        Insert: {
          bn_name?: string | null
          created_at?: string
          id?: string
          name: string
          status?: string
        }
        Update: {
          bn_name?: string | null
          created_at?: string
          id?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      geo_upazilas: {
        Row: {
          bn_name: string | null
          created_at: string
          district_id: string
          id: string
          name: string
          status: string
        }
        Insert: {
          bn_name?: string | null
          created_at?: string
          district_id: string
          id?: string
          name: string
          status?: string
        }
        Update: {
          bn_name?: string | null
          created_at?: string
          district_id?: string
          id?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_upazilas_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "geo_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonations: {
        Row: {
          admin_id: string
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          status: string
          target_user_id: string | null
          tenant_id: string
          token: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string
          expires_at: string
          id?: string
          ip_address?: string | null
          status?: string
          target_user_id?: string | null
          tenant_id: string
          token: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          status?: string
          target_user_id?: string | null
          tenant_id?: string
          token?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      income_heads: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_logs: {
        Row: {
          created_at: string
          id: string
          note: string | null
          product_id: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          product_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          product_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          type?: string
        }
        Relationships: []
      }
      ip_pools: {
        Row: {
          created_at: string
          end_ip: string
          gateway: string | null
          id: string
          mikrotik_id: string | null
          name: string
          ranges: string | null
          router_id: string | null
          start_ip: string
          status: string
          subnet: string
          total_ips: number
          type: string | null
          updated_at: string
          used_ips: number
        }
        Insert: {
          created_at?: string
          end_ip: string
          gateway?: string | null
          id?: string
          mikrotik_id?: string | null
          name: string
          ranges?: string | null
          router_id?: string | null
          start_ip: string
          status?: string
          subnet: string
          total_ips?: number
          type?: string | null
          updated_at?: string
          used_ips?: number
        }
        Update: {
          created_at?: string
          end_ip?: string
          gateway?: string | null
          id?: string
          mikrotik_id?: string | null
          name?: string
          ranges?: string | null
          router_id?: string | null
          start_ip?: string
          status?: string
          subnet?: string
          total_ips?: number
          type?: string | null
          updated_at?: string
          used_ips?: number
        }
        Relationships: [
          {
            foreignKeyName: "ip_pools_router_id_fkey"
            columns: ["router_id"]
            isOneToOne: false
            referencedRelation: "mikrotik_routers"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          amount: number
          approved_date: string | null
          created_at: string
          employee_id: string
          id: string
          monthly_deduction: number
          paid_amount: number
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          approved_date?: string | null
          created_at?: string
          employee_id: string
          id?: string
          monthly_deduction?: number
          paid_amount?: number
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_date?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          monthly_deduction?: number
          paid_amount?: number
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      login_histories: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device: string | null
          failure_reason: string | null
          id: string
          ip_address: string | null
          is_suspicious: boolean | null
          latitude: number | null
          longitude: number | null
          status: string
          suspicious_reason: string | null
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          is_suspicious?: boolean | null
          latitude?: number | null
          longitude?: number | null
          status?: string
          suspicious_reason?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          is_suspicious?: boolean | null
          latitude?: number | null
          longitude?: number | null
          status?: string
          suspicious_reason?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_histories_tenant_id_fkey"
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
      modules: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_core: boolean | null
          name: string
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_core?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_core?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          metadata: Json | null
          tenant_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          metadata?: Json | null
          tenant_id?: string | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          metadata?: Json | null
          tenant_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
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
      online_sessions: {
        Row: {
          bytes_in: number | null
          bytes_out: number | null
          connected_at: string | null
          created_at: string
          customer_id: string | null
          id: string
          ip_address: string | null
          last_seen: string | null
          mac_address: string | null
          pppoe_username: string
          router_id: string | null
          status: string
          uptime: string | null
        }
        Insert: {
          bytes_in?: number | null
          bytes_out?: number | null
          connected_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          ip_address?: string | null
          last_seen?: string | null
          mac_address?: string | null
          pppoe_username: string
          router_id?: string | null
          status?: string
          uptime?: string | null
        }
        Update: {
          bytes_in?: number | null
          bytes_out?: number | null
          connected_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          ip_address?: string | null
          last_seen?: string | null
          mac_address?: string | null
          pppoe_username?: string
          router_id?: string | null
          status?: string
          uptime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "online_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_sessions_router_id_fkey"
            columns: ["router_id"]
            isOneToOne: false
            referencedRelation: "mikrotik_routers"
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
      other_heads: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          bandwidth_profile: string | null
          burst_limit: string | null
          created_at: string
          download_speed: number
          id: string
          ip_pool_id: string | null
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
          ip_pool_id?: string | null
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
          ip_pool_id?: string | null
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
            foreignKeyName: "packages_ip_pool_id_fkey"
            columns: ["ip_pool_id"]
            isOneToOne: false
            referencedRelation: "ip_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_router_id_fkey"
            columns: ["router_id"]
            isOneToOne: false
            referencedRelation: "mikrotik_routers"
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
          receiving_account_id: string | null
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
          receiving_account_id?: string | null
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
          receiving_account_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateways_receiving_account_id_fkey"
            columns: ["receiving_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
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
      permissions: {
        Row: {
          action: string
          description: string | null
          id: string
          module: string
        }
        Insert: {
          action: string
          description?: string | null
          id?: string
          module: string
        }
        Update: {
          action?: string
          description?: string | null
          id?: string
          module?: string
        }
        Relationships: []
      }
      plan_modules: {
        Row: {
          created_at: string | null
          id: string
          module_id: string
          plan_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          module_id: string
          plan_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          module_id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      product_serials: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          product_id: string | null
          serial_number: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          serial_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          serial_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_serials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          buy_price: number
          category: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          model: string | null
          name: string
          sell_price: number
          sku: string | null
          status: string
          stock: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          buy_price?: number
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          model?: string | null
          name: string
          sell_price?: number
          sku?: string | null
          status?: string
          stock?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          buy_price?: number
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          model?: string | null
          name?: string
          sell_price?: number
          sku?: string | null
          status?: string
          stock?: number
          unit?: string | null
          updated_at?: string
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
          language: string
          mobile: string | null
          must_change_password: boolean | null
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
          language?: string
          mobile?: string | null
          must_change_password?: boolean | null
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
          language?: string
          mobile?: string | null
          must_change_password?: boolean | null
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
      purchase_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          product_id: string | null
          purchase_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          purchase_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          purchase_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          paid_amount: number
          purchase_no: string
          status: string
          supplier_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          paid_amount?: number
          purchase_no: string
          status?: string
          supplier_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          paid_amount?: number
          purchase_no?: string
          status?: string
          supplier_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
      role_permissions: {
        Row: {
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          id?: string
          permission_id?: string
          role_id?: string
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
        ]
      }
      saas_plans: {
        Row: {
          created_at: string | null
          description: string | null
          features: Json | null
          has_accounting: boolean | null
          has_custom_domain: boolean | null
          has_hr: boolean | null
          has_inventory: boolean | null
          has_sms: boolean | null
          id: string
          is_active: boolean | null
          max_customers: number | null
          max_routers: number | null
          max_users: number | null
          name: string
          price_monthly: number | null
          price_yearly: number | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          has_accounting?: boolean | null
          has_custom_domain?: boolean | null
          has_hr?: boolean | null
          has_inventory?: boolean | null
          has_sms?: boolean | null
          id?: string
          is_active?: boolean | null
          max_customers?: number | null
          max_routers?: number | null
          max_users?: number | null
          name: string
          price_monthly?: number | null
          price_yearly?: number | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          has_accounting?: boolean | null
          has_custom_domain?: boolean | null
          has_hr?: boolean | null
          has_inventory?: boolean | null
          has_sms?: boolean | null
          id?: string
          is_active?: boolean | null
          max_customers?: number | null
          max_routers?: number | null
          max_users?: number | null
          name?: string
          price_monthly?: number | null
          price_yearly?: number | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      salary_sheets: {
        Row: {
          basic_salary: number
          bonus: number
          conveyance: number
          created_at: string
          deduction: number
          employee_id: string
          house_rent: number
          id: string
          loan_deduction: number
          medical: number
          month: string
          net_salary: number
          other_allowance: number
          paid_date: string | null
          payment_method: string
          pf_deduction: number
          savings_deduction: number
          status: string
        }
        Insert: {
          basic_salary?: number
          bonus?: number
          conveyance?: number
          created_at?: string
          deduction?: number
          employee_id: string
          house_rent?: number
          id?: string
          loan_deduction?: number
          medical?: number
          month: string
          net_salary?: number
          other_allowance?: number
          paid_date?: string | null
          payment_method?: string
          pf_deduction?: number
          savings_deduction?: number
          status?: string
        }
        Update: {
          basic_salary?: number
          bonus?: number
          conveyance?: number
          created_at?: string
          deduction?: number
          employee_id?: string
          house_rent?: number
          id?: string
          loan_deduction?: number
          medical?: number
          month?: string
          net_salary?: number
          other_allowance?: number
          paid_date?: string | null
          payment_method?: string
          pf_deduction?: number
          savings_deduction?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_sheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          product_id: string | null
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          sale_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          discount: number
          id: string
          notes: string | null
          paid_amount: number
          payment_method: string
          sale_date: string
          sale_no: string
          status: string
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          id?: string
          notes?: string | null
          paid_amount?: number
          payment_method?: string
          sale_date?: string
          sale_no: string
          status?: string
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          id?: string
          notes?: string | null
          paid_amount?: number
          payment_method?: string
          sale_date?: string
          sale_no?: string
          status?: string
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          admin_cost: number | null
          cost: number
          created_at: string
          customer_id: string | null
          id: string
          message: string
          phone: string
          profit: number | null
          response: string | null
          sms_count: number | null
          sms_type: string
          status: string
          tenant_id: string | null
        }
        Insert: {
          admin_cost?: number | null
          cost?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          message: string
          phone: string
          profit?: number | null
          response?: string | null
          sms_count?: number | null
          sms_type: string
          status?: string
          tenant_id?: string | null
        }
        Update: {
          admin_cost?: number | null
          cost?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          message?: string
          phone?: string
          profit?: number | null
          response?: string | null
          sms_count?: number | null
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
        ]
      }
      sms_settings: {
        Row: {
          admin_cost_rate: number | null
          api_token: string | null
          id: string
          sender_id: string | null
          sms_on_bill_generate: boolean | null
          sms_on_new_customer_bill: boolean | null
          sms_on_payment: boolean | null
          sms_on_registration: boolean | null
          sms_on_reminder: boolean | null
          sms_on_suspension: boolean | null
          updated_at: string
          whatsapp_enabled: boolean | null
          whatsapp_phone_id: string | null
          whatsapp_token: string | null
        }
        Insert: {
          admin_cost_rate?: number | null
          api_token?: string | null
          id?: string
          sender_id?: string | null
          sms_on_bill_generate?: boolean | null
          sms_on_new_customer_bill?: boolean | null
          sms_on_payment?: boolean | null
          sms_on_registration?: boolean | null
          sms_on_reminder?: boolean | null
          sms_on_suspension?: boolean | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
          whatsapp_phone_id?: string | null
          whatsapp_token?: string | null
        }
        Update: {
          admin_cost_rate?: number | null
          api_token?: string | null
          id?: string
          sender_id?: string | null
          sms_on_bill_generate?: boolean | null
          sms_on_new_customer_bill?: boolean | null
          sms_on_payment?: boolean | null
          sms_on_registration?: boolean | null
          sms_on_reminder?: boolean | null
          sms_on_suspension?: boolean | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
          whatsapp_phone_id?: string | null
          whatsapp_token?: string | null
        }
        Relationships: []
      }
      sms_templates: {
        Row: {
          created_at: string
          id: string
          message: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sms_transactions: {
        Row: {
          admin_id: string | null
          amount: number
          balance_after: number
          created_at: string | null
          description: string | null
          id: string
          tenant_id: string
          type: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          balance_after?: number
          created_at?: string | null
          description?: string | null
          id?: string
          tenant_id: string
          type?: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          balance_after?: number
          created_at?: string | null
          description?: string | null
          id?: string
          tenant_id?: string
          type?: string
        }
        Relationships: []
      }
      sms_wallets: {
        Row: {
          balance: number
          created_at: string | null
          id: string
          sms_rate: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          balance?: number
          created_at?: string | null
          id?: string
          sms_rate?: number
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          balance?: number
          created_at?: string | null
          id?: string
          sms_rate?: number
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      smtp_settings: {
        Row: {
          created_at: string
          encryption: string | null
          from_email: string
          from_name: string
          host: string
          id: string
          password: string
          port: number
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          encryption?: string | null
          from_email?: string
          from_name?: string
          host?: string
          id?: string
          password?: string
          port?: number
          status?: string
          updated_at?: string
          username?: string
        }
        Update: {
          created_at?: string
          encryption?: string | null
          from_email?: string
          from_name?: string
          host?: string
          id?: string
          password?: string
          port?: number
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      subscription_invoices: {
        Row: {
          amount: number
          billing_cycle: string
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          paid_date: string | null
          payment_method: string | null
          plan_id: string | null
          proration_credit: number | null
          status: string
          subscription_id: string | null
          tax_amount: number
          tenant_id: string
          total_amount: number
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_cycle?: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          plan_id?: string | null
          proration_credit?: number | null
          status?: string
          subscription_id?: string | null
          tax_amount?: number
          tenant_id: string
          total_amount?: number
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          plan_id?: string | null
          proration_credit?: number | null
          status?: string
          subscription_id?: string | null
          tax_amount?: number
          tenant_id?: string
          total_amount?: number
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number | null
          billing_cycle: string | null
          created_at: string | null
          end_date: string
          id: string
          metadata: Json | null
          payment_method: string | null
          plan_id: string
          start_date: string
          status: string | null
          tenant_id: string
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          billing_cycle?: string | null
          created_at?: string | null
          end_date: string
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          plan_id: string
          start_date: string
          status?: string | null
          tenant_id: string
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          billing_cycle?: string | null
          created_at?: string | null
          end_date?: string
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          plan_id?: string
          start_date?: string
          status?: string | null
          tenant_id?: string
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_sessions: {
        Row: {
          browser: string | null
          created_at: string
          id: string
          ip_address: string | null
          session_token: string
          status: string
          super_admin_id: string
          updated_at: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          session_token: string
          status?: string
          super_admin_id: string
          updated_at?: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          session_token?: string
          status?: string
          super_admin_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "super_admin_sessions_super_admin_id_fkey"
            columns: ["super_admin_id"]
            isOneToOne: false
            referencedRelation: "super_admins"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          email: string
          failed_attempts: number
          id: string
          last_login_at: string | null
          last_login_ip: string | null
          locked_until: string | null
          name: string
          password_hash: string
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          email: string
          failed_attempts?: number
          id?: string
          last_login_at?: string | null
          last_login_ip?: string | null
          locked_until?: string | null
          name: string
          password_hash: string
          status?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          email?: string
          failed_attempts?: number
          id?: string
          last_login_at?: string | null
          last_login_ip?: string | null
          locked_until?: string | null
          name?: string
          password_hash?: string
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          paid_date: string
          payment_method: string
          purchase_id: string | null
          reference: string | null
          supplier_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_date?: string
          payment_method?: string
          purchase_id?: string | null
          reference?: string | null
          supplier_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_date?: string
          payment_method?: string
          purchase_id?: string | null
          reference?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          status: string
          total_due: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          status?: string
          total_due?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: string
          total_due?: number
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
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
          admin_notes?: string | null
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
          admin_notes?: string | null
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
      tenants: {
        Row: {
          auto_setup: boolean | null
          created_at: string | null
          email: string | null
          grace_days: number
          id: string
          logo_url: string | null
          max_customers: number | null
          max_users: number | null
          name: string
          phone: string | null
          plan: string | null
          plan_expire_date: string | null
          plan_expiry_message: string | null
          plan_id: string | null
          settings: Json | null
          setup_accounts: boolean | null
          setup_geo: boolean | null
          setup_ledger: boolean | null
          setup_status: string | null
          setup_templates: boolean | null
          status: string | null
          subdomain: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          auto_setup?: boolean | null
          created_at?: string | null
          email?: string | null
          grace_days?: number
          id?: string
          logo_url?: string | null
          max_customers?: number | null
          max_users?: number | null
          name: string
          phone?: string | null
          plan?: string | null
          plan_expire_date?: string | null
          plan_expiry_message?: string | null
          plan_id?: string | null
          settings?: Json | null
          setup_accounts?: boolean | null
          setup_geo?: boolean | null
          setup_ledger?: boolean | null
          setup_status?: string | null
          setup_templates?: boolean | null
          status?: string | null
          subdomain?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_setup?: boolean | null
          created_at?: string | null
          email?: string | null
          grace_days?: number
          id?: string
          logo_url?: string | null
          max_customers?: number | null
          max_users?: number | null
          name?: string
          phone?: string | null
          plan?: string | null
          plan_expire_date?: string | null
          plan_expiry_message?: string | null
          plan_id?: string | null
          settings?: Json | null
          setup_accounts?: boolean | null
          setup_geo?: boolean | null
          setup_ledger?: boolean | null
          setup_status?: string | null
          setup_templates?: boolean | null
          status?: string | null
          subdomain?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
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
      transactions: {
        Row: {
          account_id: string | null
          created_at: string
          created_by: string | null
          credit: number
          date: string
          debit: number
          description: string
          id: string
          reference: string | null
          type: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          credit?: number
          date?: string
          debit?: number
          description: string
          id?: string
          reference?: string | null
          type?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          credit?: number
          date?: string
          debit?: number
          description?: string
          id?: string
          reference?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          custom_role_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          custom_role_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          custom_role_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
        ]
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
        | "owner"
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
        "owner",
      ],
    },
  },
} as const
