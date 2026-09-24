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
      allergens: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          balance_due_days_before: number
          bank_account_name: string | null
          bank_account_number: string | null
          bank_details_on_invoices: boolean
          bank_details_on_quotes: boolean
          bank_sort_code: string | null
          card_fee_percentage: number
          card_payments_available: boolean
          card_wording: string | null
          city: string | null
          company_number: string | null
          country: string | null
          created_at: string
          currency: string
          default_payment_method: string
          deposit_percentage: number
          deposit_wording: string | null
          email: string | null
          id: string
          invoice_payment_terms: string | null
          legal_name: string | null
          organisation_id: string
          phone: string | null
          postcode: string | null
          quote_terms: string | null
          quote_validity_days: number
          trading_name: string
          updated_at: string
          vat_rate: number
          vat_registered: boolean
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          balance_due_days_before?: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_details_on_invoices?: boolean
          bank_details_on_quotes?: boolean
          bank_sort_code?: string | null
          card_fee_percentage?: number
          card_payments_available?: boolean
          card_wording?: string | null
          city?: string | null
          company_number?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          default_payment_method?: string
          deposit_percentage?: number
          deposit_wording?: string | null
          email?: string | null
          id?: string
          invoice_payment_terms?: string | null
          legal_name?: string | null
          organisation_id?: string
          phone?: string | null
          postcode?: string | null
          quote_terms?: string | null
          quote_validity_days?: number
          trading_name?: string
          updated_at?: string
          vat_rate?: number
          vat_registered?: boolean
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          balance_due_days_before?: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_details_on_invoices?: boolean
          bank_details_on_quotes?: boolean
          bank_sort_code?: string | null
          card_fee_percentage?: number
          card_payments_available?: boolean
          card_wording?: string | null
          city?: string | null
          company_number?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          default_payment_method?: string
          deposit_percentage?: number
          deposit_wording?: string | null
          email?: string | null
          id?: string
          invoice_payment_terms?: string | null
          legal_name?: string | null
          organisation_id?: string
          phone?: string | null
          postcode?: string | null
          quote_terms?: string | null
          quote_validity_days?: number
          trading_name?: string
          updated_at?: string
          vat_rate?: number
          vat_registered?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "business_settings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          active: boolean
          client_id: string
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_primary: boolean
          last_name: string | null
          notes: string | null
          organisation_id: string
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_primary?: boolean
          last_name?: string | null
          notes?: string | null
          organisation_id?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_primary?: boolean
          last_name?: string | null
          notes?: string | null
          organisation_id?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active: boolean
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
          source: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          active?: boolean
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
          source?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          active?: boolean
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
          source?: string | null
          updated_at?: string
          website?: string | null
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
      event_commercial_notes: {
        Row: {
          body: string
          category: string | null
          created_at: string
          event_id: string
          id: string
          organisation_id: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          event_id: string
          id?: string
          organisation_id?: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          event_id?: string
          id?: string
          organisation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_commercial_notes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_commercial_notes_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_costs: {
        Row: {
          actual_amount: number | null
          category: string
          cost_date: string | null
          created_at: string
          description: string
          estimated_amount: number | null
          event_id: string
          id: string
          notes: string | null
          organisation_id: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number | null
          category?: string
          cost_date?: string | null
          created_at?: string
          description: string
          estimated_amount?: number | null
          event_id: string
          id?: string
          notes?: string | null
          organisation_id?: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number | null
          category?: string
          cost_date?: string | null
          created_at?: string
          description?: string
          estimated_amount?: number | null
          event_id?: string
          id?: string
          notes?: string | null
          organisation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_costs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_costs_organisation_id_fkey"
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
      event_invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          organisation_id: string
          quantity: number
          sort_order: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          organisation_id?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          organisation_id?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "event_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invoice_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invoices: {
        Row: {
          billing_details: string | null
          client_name: string | null
          created_at: string
          document_snapshot: Json | null
          due_date: string | null
          event_id: string
          id: string
          invoice_number: string
          issue_date: string
          issued_at: string | null
          kind: string
          notes: string | null
          organisation_id: string
          payment_instructions: string | null
          sent_at: string | null
          status: string
          updated_at: string
          vat_enabled: boolean
          vat_rate: number
        }
        Insert: {
          billing_details?: string | null
          client_name?: string | null
          created_at?: string
          document_snapshot?: Json | null
          due_date?: string | null
          event_id: string
          id?: string
          invoice_number: string
          issue_date?: string
          issued_at?: string | null
          kind?: string
          notes?: string | null
          organisation_id?: string
          payment_instructions?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          vat_enabled?: boolean
          vat_rate?: number
        }
        Update: {
          billing_details?: string | null
          client_name?: string | null
          created_at?: string
          document_snapshot?: Json | null
          due_date?: string | null
          event_id?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          issued_at?: string | null
          kind?: string
          notes?: string | null
          organisation_id?: string
          payment_instructions?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          vat_enabled?: boolean
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_invoices_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invoices_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_kit_items: {
        Row: {
          base_quantity: number | null
          created_at: string
          event_id: string
          id: string
          kit_item_id: string
          notes: string | null
          organisation_id: string
          packed_quantity: number
          purchase_status: string
          quantity_override: number | null
          returned_quantity: number | null
          sort_order: number
          source: string
          updated_at: string
        }
        Insert: {
          base_quantity?: number | null
          created_at?: string
          event_id: string
          id?: string
          kit_item_id: string
          notes?: string | null
          organisation_id?: string
          packed_quantity?: number
          purchase_status?: string
          quantity_override?: number | null
          returned_quantity?: number | null
          sort_order?: number
          source?: string
          updated_at?: string
        }
        Update: {
          base_quantity?: number | null
          created_at?: string
          event_id?: string
          id?: string
          kit_item_id?: string
          notes?: string | null
          organisation_id?: string
          packed_quantity?: number
          purchase_status?: string
          quantity_override?: number | null
          returned_quantity?: number | null
          sort_order?: number
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_kit_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_kit_items_kit_item_id_fkey"
            columns: ["kit_item_id"]
            isOneToOne: false
            referencedRelation: "kit_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_kit_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_menu_items: {
        Row: {
          created_at: string
          event_id: string
          id: string
          notes: string | null
          organisation_id: string
          portion_size: string
          quantity_per_guest: number | null
          quantity_unit: Database["public"]["Enums"]["base_unit"]
          recipe_id: string
          recipe_version_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          organisation_id?: string
          portion_size?: string
          quantity_per_guest?: number | null
          quantity_unit?: Database["public"]["Enums"]["base_unit"]
          recipe_id: string
          recipe_version_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          organisation_id?: string
          portion_size?: string
          quantity_per_guest?: number | null
          quantity_unit?: Database["public"]["Enums"]["base_unit"]
          recipe_id?: string
          recipe_version_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_menu_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_menu_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_menu_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_menu_items_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "recipe_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_packing_checks: {
        Row: {
          created_at: string
          event_id: string
          id: string
          item_key: string
          organisation_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          item_key: string
          organisation_id?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          item_key?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_packing_checks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_packing_checks_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_packing_items: {
        Row: {
          category: string
          created_at: string
          event_id: string
          id: string
          name: string
          organisation_id: string
          quantity: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          event_id: string
          id?: string
          name: string
          organisation_id?: string
          quantity?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          organisation_id?: string
          quantity?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_packing_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_packing_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_payment_allocations: {
        Row: {
          amount: number
          created_at: string
          event_id: string
          id: string
          invoice_id: string
          organisation_id: string
          payment_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          event_id: string
          id?: string
          invoice_id: string
          organisation_id?: string
          payment_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          event_id?: string
          id?: string
          invoice_id?: string
          organisation_id?: string
          payment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_payment_allocations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "event_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payment_allocations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "event_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      event_payment_terms: {
        Row: {
          actual_payout: number | null
          actual_payout_date: string | null
          agreed_total_override: number | null
          agreed_total_source: string | null
          balance_due_date: string | null
          balance_due_days_before: number
          card_fee_applied: boolean
          card_fee_percentage: number
          created_at: string
          deposit_amount: number | null
          deposit_due_date: string | null
          deposit_mode: string
          deposit_percentage: number
          event_id: string
          expected_payout: number | null
          expected_payout_date: string | null
          id: string
          notes: string | null
          organisation_id: string
          payout_status: string
          updated_at: string
          vat_enabled: boolean
          vat_rate: number
        }
        Insert: {
          actual_payout?: number | null
          actual_payout_date?: string | null
          agreed_total_override?: number | null
          agreed_total_source?: string | null
          balance_due_date?: string | null
          balance_due_days_before?: number
          card_fee_applied?: boolean
          card_fee_percentage?: number
          created_at?: string
          deposit_amount?: number | null
          deposit_due_date?: string | null
          deposit_mode?: string
          deposit_percentage?: number
          event_id: string
          expected_payout?: number | null
          expected_payout_date?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string
          payout_status?: string
          updated_at?: string
          vat_enabled?: boolean
          vat_rate?: number
        }
        Update: {
          actual_payout?: number | null
          actual_payout_date?: string | null
          agreed_total_override?: number | null
          agreed_total_source?: string | null
          balance_due_date?: string | null
          balance_due_days_before?: number
          card_fee_applied?: boolean
          card_fee_percentage?: number
          created_at?: string
          deposit_amount?: number | null
          deposit_due_date?: string | null
          deposit_mode?: string
          deposit_percentage?: number
          event_id?: string
          expected_payout?: number | null
          expected_payout_date?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string
          payout_status?: string
          updated_at?: string
          vat_enabled?: boolean
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_payment_terms_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payment_terms_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_payments: {
        Row: {
          amount: number
          category: string
          created_at: string
          event_id: string
          id: string
          invoice_id: string | null
          method: string
          notes: string | null
          organisation_id: string
          payment_date: string
          reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          event_id: string
          id?: string
          invoice_id?: string | null
          method?: string
          notes?: string | null
          organisation_id?: string
          payment_date?: string
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          event_id?: string
          id?: string
          invoice_id?: string | null
          method?: string
          notes?: string | null
          organisation_id?: string
          payment_date?: string
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "event_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payments_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_pricing_charges: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          option_id: string
          organisation_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          option_id: string
          organisation_id?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          option_id?: string
          organisation_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_pricing_charges_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "event_pricing_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_pricing_charges_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_pricing_option_sections: {
        Row: {
          created_at: string
          id: string
          option_id: string
          organisation_id: string
          section_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          organisation_id?: string
          section_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          organisation_id?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_pricing_option_sections_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "event_pricing_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_pricing_option_sections_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_pricing_option_sections_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "event_proposal_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      event_pricing_options: {
        Row: {
          created_at: string
          event_id: string
          guest_count_override: number | null
          id: string
          is_selected: boolean
          name: string
          notes: string | null
          organisation_id: string
          payment_fee_percentage: number | null
          price_per_head: number | null
          sort_order: number
          updated_at: string
          vat_enabled: boolean
          vat_rate: number
        }
        Insert: {
          created_at?: string
          event_id: string
          guest_count_override?: number | null
          id?: string
          is_selected?: boolean
          name: string
          notes?: string | null
          organisation_id?: string
          payment_fee_percentage?: number | null
          price_per_head?: number | null
          sort_order?: number
          updated_at?: string
          vat_enabled?: boolean
          vat_rate?: number
        }
        Update: {
          created_at?: string
          event_id?: string
          guest_count_override?: number | null
          id?: string
          is_selected?: boolean
          name?: string
          notes?: string | null
          organisation_id?: string
          payment_fee_percentage?: number | null
          price_per_head?: number | null
          sort_order?: number
          updated_at?: string
          vat_enabled?: boolean
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_pricing_options_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_pricing_options_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_proposal_items: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          notes: string | null
          organisation_id: string
          recipe_id: string | null
          section_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          notes?: string | null
          organisation_id?: string
          recipe_id?: string | null
          section_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          notes?: string | null
          organisation_id?: string
          recipe_id?: string | null
          section_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_proposal_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_proposal_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_proposal_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_proposal_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "event_proposal_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      event_proposal_sections: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          notes: string | null
          organisation_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          notes?: string | null
          organisation_id?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          notes?: string | null
          organisation_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_proposal_sections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_proposal_sections_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_quote_charges: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          organisation_id: string
          quote_id: string
          show_on_quote: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          organisation_id?: string
          quote_id: string
          show_on_quote?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          organisation_id?: string
          quote_id?: string
          show_on_quote?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_quote_charges_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_quote_charges_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "event_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      event_quote_items: {
        Row: {
          created_at: string
          id: string
          name: string
          organisation_id: string
          quote_id: string
          section_id: string
          sort_order: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organisation_id?: string
          quote_id: string
          section_id: string
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organisation_id?: string
          quote_id?: string
          section_id?: string
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "event_quote_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "event_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_quote_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "event_quote_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      event_quote_sections: {
        Row: {
          created_at: string
          id: string
          included: boolean
          name: string
          organisation_id: string
          quote_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          included?: boolean
          name: string
          organisation_id?: string
          quote_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          included?: boolean
          name?: string
          organisation_id?: string
          quote_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_quote_sections_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_quote_sections_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "event_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      event_quotes: {
        Row: {
          accepted_at: string | null
          agreed_total: number | null
          card_fee_enabled: boolean
          card_fee_percentage: number | null
          catering_label: string
          client_name: string | null
          client_notes: string | null
          created_at: string
          cuisine: string | null
          document_snapshot: Json | null
          event_date: string | null
          event_id: string
          event_name: string | null
          event_type: string | null
          guest_count: number | null
          id: string
          introduction: string | null
          issued_at: string | null
          organisation_id: string
          price_per_head: number | null
          pricing_option_id: string | null
          quote_date: string | null
          quote_number: string | null
          revision: number
          sent_at: string | null
          service_style: string | null
          status: string
          terms: string | null
          title: string | null
          updated_at: string
          valid_until: string | null
          vat_enabled: boolean
          vat_rate: number
          venue: string | null
          whats_included: string | null
        }
        Insert: {
          accepted_at?: string | null
          agreed_total?: number | null
          card_fee_enabled?: boolean
          card_fee_percentage?: number | null
          catering_label?: string
          client_name?: string | null
          client_notes?: string | null
          created_at?: string
          cuisine?: string | null
          document_snapshot?: Json | null
          event_date?: string | null
          event_id: string
          event_name?: string | null
          event_type?: string | null
          guest_count?: number | null
          id?: string
          introduction?: string | null
          issued_at?: string | null
          organisation_id?: string
          price_per_head?: number | null
          pricing_option_id?: string | null
          quote_date?: string | null
          quote_number?: string | null
          revision?: number
          sent_at?: string | null
          service_style?: string | null
          status?: string
          terms?: string | null
          title?: string | null
          updated_at?: string
          valid_until?: string | null
          vat_enabled?: boolean
          vat_rate?: number
          venue?: string | null
          whats_included?: string | null
        }
        Update: {
          accepted_at?: string | null
          agreed_total?: number | null
          card_fee_enabled?: boolean
          card_fee_percentage?: number | null
          catering_label?: string
          client_name?: string | null
          client_notes?: string | null
          created_at?: string
          cuisine?: string | null
          document_snapshot?: Json | null
          event_date?: string | null
          event_id?: string
          event_name?: string | null
          event_type?: string | null
          guest_count?: number | null
          id?: string
          introduction?: string | null
          issued_at?: string | null
          organisation_id?: string
          price_per_head?: number | null
          pricing_option_id?: string | null
          quote_date?: string | null
          quote_number?: string | null
          revision?: number
          sent_at?: string | null
          service_style?: string | null
          status?: string
          terms?: string | null
          title?: string | null
          updated_at?: string
          valid_until?: string | null
          vat_enabled?: boolean
          vat_rate?: number
          venue?: string | null
          whats_included?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_quotes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_quotes_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_quotes_pricing_option_id_fkey"
            columns: ["pricing_option_id"]
            isOneToOne: false
            referencedRelation: "event_pricing_options"
            referencedColumns: ["id"]
          },
        ]
      }
      event_run_sheet_items: {
        Row: {
          anchor_type: string
          assignment: string
          completed_at: string | null
          created_at: string
          duration_minutes: number | null
          event_id: string
          fixed_time: string | null
          generated_at: string | null
          id: string
          is_milestone: boolean
          name: string
          notes: string | null
          offset_minutes: number
          organisation_id: string
          sort_order: number
          source: string
          status: string
          template_item_id: string | null
          updated_at: string
        }
        Insert: {
          anchor_type: string
          assignment?: string
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          event_id: string
          fixed_time?: string | null
          generated_at?: string | null
          id?: string
          is_milestone?: boolean
          name: string
          notes?: string | null
          offset_minutes?: number
          organisation_id: string
          sort_order?: number
          source?: string
          status?: string
          template_item_id?: string | null
          updated_at?: string
        }
        Update: {
          anchor_type?: string
          assignment?: string
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          event_id?: string
          fixed_time?: string | null
          generated_at?: string | null
          id?: string
          is_milestone?: boolean
          name?: string
          notes?: string | null
          offset_minutes?: number
          organisation_id?: string
          sort_order?: number
          source?: string
          status?: string
          template_item_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_run_sheet_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_run_sheet_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_run_sheet_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "run_sheet_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      event_shopping_checks: {
        Row: {
          created_at: string
          event_id: string
          id: string
          ingredient_id: string
          organisation_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          ingredient_id: string
          organisation_id?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          ingredient_id?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_shopping_checks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_shopping_checks_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_shopping_checks_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_staff_shifts: {
        Row: {
          actual_break_minutes: number | null
          actual_end_time: string | null
          actual_start_time: string | null
          break_minutes: number | null
          created_at: string
          end_time: string | null
          event_id: string
          hourly_rate: number
          id: string
          is_owner: boolean
          notes: string | null
          organisation_id: string
          paid_at: string | null
          payment_note: string | null
          payment_status: string
          role_label: string | null
          shift_date: string | null
          sort_order: number
          staff_member_id: string | null
          start_time: string | null
          updated_at: string
          work_type: string
        }
        Insert: {
          actual_break_minutes?: number | null
          actual_end_time?: string | null
          actual_start_time?: string | null
          break_minutes?: number | null
          created_at?: string
          end_time?: string | null
          event_id: string
          hourly_rate?: number
          id?: string
          is_owner?: boolean
          notes?: string | null
          organisation_id?: string
          paid_at?: string | null
          payment_note?: string | null
          payment_status?: string
          role_label?: string | null
          shift_date?: string | null
          sort_order?: number
          staff_member_id?: string | null
          start_time?: string | null
          updated_at?: string
          work_type?: string
        }
        Update: {
          actual_break_minutes?: number | null
          actual_end_time?: string | null
          actual_start_time?: string | null
          break_minutes?: number | null
          created_at?: string
          end_time?: string | null
          event_id?: string
          hourly_rate?: number
          id?: string
          is_owner?: boolean
          notes?: string | null
          organisation_id?: string
          paid_at?: string | null
          payment_note?: string | null
          payment_status?: string
          role_label?: string | null
          shift_date?: string | null
          sort_order?: number
          staff_member_id?: string | null
          start_time?: string | null
          updated_at?: string
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_staff_shifts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_staff_shifts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_staff_shifts_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tasks: {
        Row: {
          approximate_minutes: number | null
          assignment: string
          completed_at: string | null
          component_recipe_id: string | null
          created_at: string
          event_id: string
          generated_at: string | null
          id: string
          name: string
          notes: string | null
          organisation_id: string
          prep_step_id: string | null
          recipe_id: string | null
          scheduled_date: string | null
          sort_order: number
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          approximate_minutes?: number | null
          assignment?: string
          completed_at?: string | null
          component_recipe_id?: string | null
          created_at?: string
          event_id: string
          generated_at?: string | null
          id?: string
          name: string
          notes?: string | null
          organisation_id?: string
          prep_step_id?: string | null
          recipe_id?: string | null
          scheduled_date?: string | null
          sort_order?: number
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          approximate_minutes?: number | null
          assignment?: string
          completed_at?: string | null
          component_recipe_id?: string | null
          created_at?: string
          event_id?: string
          generated_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          organisation_id?: string
          prep_step_id?: string | null
          recipe_id?: string | null
          scheduled_date?: string | null
          sort_order?: number
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tasks_component_recipe_id_fkey"
            columns: ["component_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tasks_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tasks_prep_step_id_fkey"
            columns: ["prep_step_id"]
            isOneToOne: false
            referencedRelation: "recipe_prep_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tasks_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          arrival_lead_minutes: number | null
          arrival_time: string | null
          budget: number | null
          budget_flexible: boolean | null
          budget_max: number | null
          budget_min: number | null
          client_id: string | null
          closed_at: string | null
          closeout_state: string
          completed_at: string | null
          contact_id: string | null
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
          logistics_notes: string | null
          organisation_id: string
          power_access: string | null
          service_style: string | null
          service_time: string | null
          source: Database["public"]["Enums"]["event_source"]
          source_reference: string | null
          status: Database["public"]["Enums"]["event_status"]
          title: string
          travel_buffer_minutes: number | null
          travel_minutes: number | null
          updated_at: string
          venue_address: string | null
          venue_contact_name: string | null
          venue_contact_phone: string | null
          venue_name: string | null
          venue_setup_notes: string | null
          water_access: string | null
        }
        Insert: {
          arrival_lead_minutes?: number | null
          arrival_time?: string | null
          budget?: number | null
          budget_flexible?: boolean | null
          budget_max?: number | null
          budget_min?: number | null
          client_id?: string | null
          closed_at?: string | null
          closeout_state?: string
          completed_at?: string | null
          contact_id?: string | null
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
          logistics_notes?: string | null
          organisation_id?: string
          power_access?: string | null
          service_style?: string | null
          service_time?: string | null
          source?: Database["public"]["Enums"]["event_source"]
          source_reference?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          travel_buffer_minutes?: number | null
          travel_minutes?: number | null
          updated_at?: string
          venue_address?: string | null
          venue_contact_name?: string | null
          venue_contact_phone?: string | null
          venue_name?: string | null
          venue_setup_notes?: string | null
          water_access?: string | null
        }
        Update: {
          arrival_lead_minutes?: number | null
          arrival_time?: string | null
          budget?: number | null
          budget_flexible?: boolean | null
          budget_max?: number | null
          budget_min?: number | null
          client_id?: string | null
          closed_at?: string | null
          closeout_state?: string
          completed_at?: string | null
          contact_id?: string | null
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
          logistics_notes?: string | null
          organisation_id?: string
          power_access?: string | null
          service_style?: string | null
          service_time?: string | null
          source?: Database["public"]["Enums"]["event_source"]
          source_reference?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          travel_buffer_minutes?: number | null
          travel_minutes?: number | null
          updated_at?: string
          venue_address?: string | null
          venue_contact_name?: string | null
          venue_contact_phone?: string | null
          venue_name?: string | null
          venue_setup_notes?: string | null
          water_access?: string | null
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
            foreignKeyName: "events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
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
      ingredient_allergens: {
        Row: {
          allergen_id: string
          created_at: string
          id: string
          ingredient_id: string
          organisation_id: string
        }
        Insert: {
          allergen_id: string
          created_at?: string
          id?: string
          ingredient_id: string
          organisation_id?: string
        }
        Update: {
          allergen_id?: string
          created_at?: string
          id?: string
          ingredient_id?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_allergens_allergen_id_fkey"
            columns: ["allergen_id"]
            isOneToOne: false
            referencedRelation: "allergens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_allergens_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_allergens_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          active: boolean
          base_unit: Database["public"]["Enums"]["base_unit"]
          category: string
          cost_price: number | null
          cost_quantity: number | null
          cost_unit: string | null
          created_at: string
          current_unit_cost: number | null
          default_supplier_id: string | null
          id: string
          is_demo: boolean
          name: string
          notes: string | null
          organisation_id: string
          track_inventory: boolean
          updated_at: string
          yield_percentage: number
        }
        Insert: {
          active?: boolean
          base_unit?: Database["public"]["Enums"]["base_unit"]
          category?: string
          cost_price?: number | null
          cost_quantity?: number | null
          cost_unit?: string | null
          created_at?: string
          current_unit_cost?: number | null
          default_supplier_id?: string | null
          id?: string
          is_demo?: boolean
          name: string
          notes?: string | null
          organisation_id?: string
          track_inventory?: boolean
          updated_at?: string
          yield_percentage?: number
        }
        Update: {
          active?: boolean
          base_unit?: Database["public"]["Enums"]["base_unit"]
          category?: string
          cost_price?: number | null
          cost_quantity?: number | null
          cost_unit?: string | null
          created_at?: string
          current_unit_cost?: number | null
          default_supplier_id?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          notes?: string | null
          organisation_id?: string
          track_inventory?: boolean
          updated_at?: string
          yield_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_items: {
        Row: {
          active: boolean
          category: string
          created_at: string
          id: string
          name: string
          notes: string | null
          organisation_id: string
          owned_quantity: number | null
          per_guest: number | null
          sort_order: number
          template_buffet: number | null
          template_drop_off: number | null
          template_table: number | null
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          organisation_id?: string
          owned_quantity?: number | null
          per_guest?: number | null
          sort_order?: number
          template_buffet?: number | null
          template_drop_off?: number | null
          template_table?: number | null
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          organisation_id?: string
          owned_quantity?: number | null
          per_guest?: number | null
          sort_order?: number
          template_buffet?: number | null
          template_drop_off?: number | null
          template_table?: number | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kit_items_organisation_id_fkey"
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
      recipe_components: {
        Row: {
          child_recipe_version_id: string
          created_at: string
          id: string
          organisation_id: string
          parent_recipe_version_id: string
          quantity: number
          sort_order: number
          unit: Database["public"]["Enums"]["base_unit"]
        }
        Insert: {
          child_recipe_version_id: string
          created_at?: string
          id?: string
          organisation_id?: string
          parent_recipe_version_id: string
          quantity: number
          sort_order?: number
          unit: Database["public"]["Enums"]["base_unit"]
        }
        Update: {
          child_recipe_version_id?: string
          created_at?: string
          id?: string
          organisation_id?: string
          parent_recipe_version_id?: string
          quantity?: number
          sort_order?: number
          unit?: Database["public"]["Enums"]["base_unit"]
        }
        Relationships: [
          {
            foreignKeyName: "recipe_components_child_recipe_version_id_fkey"
            columns: ["child_recipe_version_id"]
            isOneToOne: false
            referencedRelation: "recipe_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_components_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_components_parent_recipe_version_id_fkey"
            columns: ["parent_recipe_version_id"]
            isOneToOne: false
            referencedRelation: "recipe_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          organisation_id: string
          prep_note: string | null
          quantity: number
          recipe_version_id: string
          sort_order: number
          unit: Database["public"]["Enums"]["base_unit"]
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          organisation_id?: string
          prep_note?: string | null
          quantity: number
          recipe_version_id: string
          sort_order?: number
          unit: Database["public"]["Enums"]["base_unit"]
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          organisation_id?: string
          prep_note?: string | null
          quantity?: number
          recipe_version_id?: string
          sort_order?: number
          unit?: Database["public"]["Enums"]["base_unit"]
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "recipe_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_prep_steps: {
        Row: {
          approximate_minutes: number | null
          can_do_earlier: boolean
          can_freeze: boolean
          component_recipe_id: string | null
          created_at: string
          default_assignment: string
          defrost_lead_days: number | null
          id: string
          name: string
          notes: string | null
          organisation_id: string
          recipe_id: string
          recommended_days_before: number
          sort_order: number
          target: string
          updated_at: string
        }
        Insert: {
          approximate_minutes?: number | null
          can_do_earlier?: boolean
          can_freeze?: boolean
          component_recipe_id?: string | null
          created_at?: string
          default_assignment?: string
          defrost_lead_days?: number | null
          id?: string
          name: string
          notes?: string | null
          organisation_id?: string
          recipe_id: string
          recommended_days_before?: number
          sort_order?: number
          target?: string
          updated_at?: string
        }
        Update: {
          approximate_minutes?: number | null
          can_do_earlier?: boolean
          can_freeze?: boolean
          component_recipe_id?: string | null
          created_at?: string
          default_assignment?: string
          defrost_lead_days?: number | null
          id?: string
          name?: string
          notes?: string | null
          organisation_id?: string
          recipe_id?: string
          recommended_days_before?: number
          sort_order?: number
          target?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_prep_steps_component_recipe_id_fkey"
            columns: ["component_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_prep_steps_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_prep_steps_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_production_profiles: {
        Row: {
          active: boolean
          buffer_percentage: number
          created_at: string
          expected_uptake_percentage: number
          id: string
          name: string
          organisation_id: string
          quantity_per_guest: number
          recipe_id: string
          service_style: string | null
          unit: Database["public"]["Enums"]["base_unit"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          buffer_percentage?: number
          created_at?: string
          expected_uptake_percentage?: number
          id?: string
          name: string
          organisation_id?: string
          quantity_per_guest: number
          recipe_id: string
          service_style?: string | null
          unit: Database["public"]["Enums"]["base_unit"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          buffer_percentage?: number
          created_at?: string
          expected_uptake_percentage?: number
          id?: string
          name?: string
          organisation_id?: string
          quantity_per_guest?: number
          recipe_id?: string
          service_style?: string | null
          unit?: Database["public"]["Enums"]["base_unit"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_production_profiles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_production_profiles_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_versions: {
        Row: {
          base_yield_quantity: number
          base_yield_unit: Database["public"]["Enums"]["base_unit"]
          change_notes: string | null
          created_at: string
          default_buffer_percentage: number
          default_portion_quantity: number | null
          default_portion_unit: Database["public"]["Enums"]["base_unit"] | null
          id: string
          method: string | null
          organisation_id: string
          recipe_id: string
          version_number: number
        }
        Insert: {
          base_yield_quantity: number
          base_yield_unit?: Database["public"]["Enums"]["base_unit"]
          change_notes?: string | null
          created_at?: string
          default_buffer_percentage?: number
          default_portion_quantity?: number | null
          default_portion_unit?: Database["public"]["Enums"]["base_unit"] | null
          id?: string
          method?: string | null
          organisation_id?: string
          recipe_id: string
          version_number?: number
        }
        Update: {
          base_yield_quantity?: number
          base_yield_unit?: Database["public"]["Enums"]["base_unit"]
          change_notes?: string | null
          created_at?: string
          default_buffer_percentage?: number
          default_portion_quantity?: number | null
          default_portion_unit?: Database["public"]["Enums"]["base_unit"] | null
          id?: string
          method?: string | null
          organisation_id?: string
          recipe_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_versions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          active: boolean
          active_version_id: string | null
          approximate_active_minutes: number | null
          can_freeze: boolean
          can_make_ahead: boolean
          category: string
          created_at: string
          cuisine: string | null
          default_storage: string
          description: string | null
          id: string
          is_demo: boolean
          name: string
          operational_notes: string | null
          organisation_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          active_version_id?: string | null
          approximate_active_minutes?: number | null
          can_freeze?: boolean
          can_make_ahead?: boolean
          category?: string
          created_at?: string
          cuisine?: string | null
          default_storage?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name: string
          operational_notes?: string | null
          organisation_id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          active_version_id?: string | null
          approximate_active_minutes?: number | null
          can_freeze?: boolean
          can_make_ahead?: boolean
          category?: string
          created_at?: string
          cuisine?: string | null
          default_storage?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          operational_notes?: string | null
          organisation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_active_version_fkey"
            columns: ["active_version_id"]
            isOneToOne: false
            referencedRelation: "recipe_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      run_sheet_template_items: {
        Row: {
          anchor_type: string
          assignment: string
          created_at: string
          duration_minutes: number | null
          fixed_time: string | null
          id: string
          is_milestone: boolean
          name: string
          offset_minutes: number
          sort_order: number
          template_id: string
        }
        Insert: {
          anchor_type: string
          assignment?: string
          created_at?: string
          duration_minutes?: number | null
          fixed_time?: string | null
          id?: string
          is_milestone?: boolean
          name: string
          offset_minutes?: number
          sort_order?: number
          template_id: string
        }
        Update: {
          anchor_type?: string
          assignment?: string
          created_at?: string
          duration_minutes?: number | null
          fixed_time?: string | null
          id?: string
          is_milestone?: boolean
          name?: string
          offset_minutes?: number
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_sheet_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "run_sheet_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      run_sheet_templates: {
        Row: {
          created_at: string
          id: string
          key: string
          name: string
          organisation_id: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          name: string
          organisation_id?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          name?: string
          organisation_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "run_sheet_templates_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          active: boolean
          created_at: string
          default_hourly_rate: number
          email: string | null
          id: string
          name: string
          notes: string | null
          organisation_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_hourly_rate?: number
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organisation_id?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_hourly_rate?: number
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organisation_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_organisation_id_fkey"
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
      base_unit: "g" | "ml" | "each"
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
      base_unit: ["g", "ml", "each"],
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
