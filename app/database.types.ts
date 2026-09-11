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
      budget_categories: {
        Row: {
          archived_at: string | null
          category_type: string
          color: string | null
          created_at: string
          created_by: string
          household_id: string
          icon: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category_type?: string
          color?: string | null
          created_at?: string
          created_by: string
          household_id: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category_type?: string
          color?: string | null
          created_at?: string
          created_by?: string
          household_id?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          budget_id: string
          category_id: string
          created_at: string
          household_id: string
          id: string
          planned_amount: number
          updated_at: string
        }
        Insert: {
          budget_id: string
          category_id: string
          created_at?: string
          household_id: string
          id?: string
          planned_amount?: number
          updated_at?: string
        }
        Update: {
          budget_id?: string
          category_id?: string
          created_at?: string
          household_id?: string
          id?: string
          planned_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_household_id_fkey"
            columns: ["budget_id", "household_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "budget_items_category_id_household_id_fkey"
            columns: ["category_id", "household_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "budget_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          created_at: string
          created_by: string
          household_id: string
          id: string
          income_target: number
          month: string
          name: string
          spending_target: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          income_target?: number
          month: string
          name?: string
          spending_target?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          income_target?: number
          month?: string
          name?: string
          spending_target?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: { all_day: boolean; assigned_to: string | null; created_at: string; created_by: string; description: string | null; ends_at: string; household_id: string; id: string; location: string | null; recurrence: string; recurrence_end_on: string | null; recurrence_interval: number; starts_at: string; timezone: string; title: string; updated_at: string }
        Insert: { all_day?: boolean; assigned_to?: string | null; created_at?: string; created_by: string; description?: string | null; ends_at: string; household_id: string; id?: string; location?: string | null; recurrence?: string; recurrence_end_on?: string | null; recurrence_interval?: number; starts_at: string; timezone?: string; title: string; updated_at?: string }
        Update: { all_day?: boolean; assigned_to?: string | null; created_at?: string; created_by?: string; description?: string | null; ends_at?: string; household_id?: string; id?: string; location?: string | null; recurrence?: string; recurrence_end_on?: string | null; recurrence_interval?: number; starts_at?: string; timezone?: string; title?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "calendar_events_household_id_fkey"; columns: ["household_id"]; isOneToOne: false; referencedRelation: "households"; referencedColumns: ["id"] }]
      }
      calendar_event_exceptions: {
        Row: { cancelled: boolean; created_at: string; created_by: string; description: string | null; ends_at: string | null; event_id: string; household_id: string; id: string; location: string | null; occurrence_start: string; starts_at: string | null; title: string | null; updated_at: string }
        Insert: { cancelled?: boolean; created_at?: string; created_by: string; description?: string | null; ends_at?: string | null; event_id: string; household_id: string; id?: string; location?: string | null; occurrence_start: string; starts_at?: string | null; title?: string | null; updated_at?: string }
        Update: { cancelled?: boolean; created_at?: string; created_by?: string; description?: string | null; ends_at?: string | null; event_id?: string; household_id?: string; id?: string; location?: string | null; occurrence_start?: string; starts_at?: string | null; title?: string | null; updated_at?: string }
        Relationships: [
          { foreignKeyName: "calendar_event_exceptions_event_id_household_id_fkey"; columns: ["event_id", "household_id"]; isOneToOne: false; referencedRelation: "calendar_events"; referencedColumns: ["id", "household_id"] },
          { foreignKeyName: "calendar_event_exceptions_household_id_fkey"; columns: ["household_id"]; isOneToOne: false; referencedRelation: "households"; referencedColumns: ["id"] },
        ]
      }
      calendar_event_reminders: {
        Row: { channels: string[]; created_at: string; event_id: string; household_id: string; id: string; minutes_before: number; updated_at: string }
        Insert: { channels?: string[]; created_at?: string; event_id: string; household_id: string; id?: string; minutes_before?: number; updated_at?: string }
        Update: { channels?: string[]; created_at?: string; event_id?: string; household_id?: string; id?: string; minutes_before?: number; updated_at?: string }
        Relationships: [
          { foreignKeyName: "calendar_event_reminders_event_id_household_id_fkey"; columns: ["event_id", "household_id"]; isOneToOne: false; referencedRelation: "calendar_events"; referencedColumns: ["id", "household_id"] },
          { foreignKeyName: "calendar_event_reminders_household_id_fkey"; columns: ["household_id"]; isOneToOne: false; referencedRelation: "households"; referencedColumns: ["id"] },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string
          extracted_text: string | null
          household_id: string
          id: string
          kind: string
          mime_type: string
          owner_user_id: string
          processing_status: string
          size_bytes: number
          storage_path: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by: string
          extracted_text?: string | null
          household_id: string
          id?: string
          kind?: string
          mime_type: string
          owner_user_id: string
          processing_status?: string
          size_bytes: number
          storage_path: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          extracted_text?: string | null
          household_id?: string
          id?: string
          kind?: string
          mime_type?: string
          owner_user_id?: string
          processing_status?: string
          size_bytes?: number
          storage_path?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_documents: {
        Row: {
          created_at: string
          created_by: string
          document_id: string
          household_id: string
          subscription_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          document_id: string
          household_id: string
          subscription_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          document_id?: string
          household_id?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_documents_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_documents_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          account_identifier: string | null
          amount: number | null
          billing_interval_months: number
          cancellation_deadline_on: string | null
          created_at: string
          created_by: string
          household_id: string
          id: string
          linked_transaction_id: string | null
          name: string
          next_payment_on: string | null
          password_manager_url: string | null
          status: string
          trial_ends_on: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          account_identifier?: string | null
          amount?: number | null
          billing_interval_months?: number
          cancellation_deadline_on?: string | null
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          linked_transaction_id?: string | null
          name: string
          next_payment_on?: string | null
          password_manager_url?: string | null
          status?: string
          trial_ends_on?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          account_identifier?: string | null
          amount?: number | null
          billing_interval_months?: number
          cancellation_deadline_on?: string | null
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          linked_transaction_id?: string | null
          name?: string
          next_payment_on?: string | null
          password_manager_url?: string | null
          status?: string
          trial_ends_on?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_linked_transaction_id_fkey"
            columns: ["linked_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          household_id: string
          joined_at?: string
          role: string
          user_id: string
        }
        Update: {
          household_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          id: string
          locale: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          locale?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          locale?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      meal_plan_items: {
        Row: {
          created_at: string
          day_of_week: number
          duration_minutes: number | null
          household_id: string
          id: string
          meal_plan_id: string
          meal_slot: number
          notes: string | null
          servings: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          duration_minutes?: number | null
          household_id: string
          id?: string
          meal_plan_id: string
          meal_slot?: number
          notes?: string | null
          servings?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          duration_minutes?: number | null
          household_id?: string
          id?: string
          meal_plan_id?: string
          meal_slot?: number
          notes?: string | null
          servings?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_items_meal_plan_id_household_id_fkey"
            columns: ["meal_plan_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      meal_plan_ingredients: {
        Row: {
          created_at: string
          household_id: string
          id: string
          meal_plan_item_id: string
          name: string
          quantity: number | null
          unit: string | null
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          meal_plan_item_id: string
          name: string
          quantity?: number | null
          unit?: string | null
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          meal_plan_item_id?: string
          name?: string
          quantity?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_ingredients_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_ingredients_meal_plan_item_id_household_id_fkey"
            columns: ["meal_plan_item_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_items"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string
          created_by: string
          household_id: string
          id: string
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          updated_at?: string
          week_start: string
        }
        Update: {
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: { email_enabled: boolean; in_app_enabled: boolean; updated_at: string; user_id: string }
        Insert: { email_enabled?: boolean; in_app_enabled?: boolean; updated_at?: string; user_id: string }
        Update: { email_enabled?: boolean; in_app_enabled?: boolean; updated_at?: string; user_id?: string }
        Relationships: []
      }
      notifications: {
        Row: { body: string | null; created_at: string; event_id: string | null; household_id: string; id: string; occurrence_start: string | null; read_at: string | null; title: string; user_id: string }
        Insert: { body?: string | null; created_at?: string; event_id?: string | null; household_id: string; id?: string; occurrence_start?: string | null; read_at?: string | null; title: string; user_id: string }
        Update: { body?: string | null; created_at?: string; event_id?: string | null; household_id?: string; id?: string; occurrence_start?: string | null; read_at?: string | null; title?: string; user_id?: string }
        Relationships: [
          { foreignKeyName: "notifications_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "calendar_events"; referencedColumns: ["id"] },
          { foreignKeyName: "notifications_household_id_fkey"; columns: ["household_id"]; isOneToOne: false; referencedRelation: "households"; referencedColumns: ["id"] },
        ]
      }
      calendar_reminder_deliveries: {
        Row: { attempted_at: string | null; channel: string; created_at: string; error_message: string | null; event_id: string; household_id: string; id: string; occurrence_start: string; sent_at: string | null; status: string; user_id: string }
        Insert: { attempted_at?: string | null; channel: string; created_at?: string; error_message?: string | null; event_id: string; household_id: string; id?: string; occurrence_start: string; sent_at?: string | null; status?: string; user_id: string }
        Update: { attempted_at?: string | null; channel?: string; created_at?: string; error_message?: string | null; event_id?: string; household_id?: string; id?: string; occurrence_start?: string; sent_at?: string | null; status?: string; user_id?: string }
        Relationships: [
          { foreignKeyName: "calendar_reminder_deliveries_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "calendar_events"; referencedColumns: ["id"] },
          { foreignKeyName: "calendar_reminder_deliveries_household_id_fkey"; columns: ["household_id"]; isOneToOne: false; referencedRelation: "households"; referencedColumns: ["id"] },
        ]
      }
      profiles: {
        Row: {
          appearance: string
          created_at: string
          full_name: string | null
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          appearance?: string
          created_at?: string
          full_name?: string | null
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          appearance?: string
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      shopping_items: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          household_id: string
          id: string
          quantity: string | null
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          quantity?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          quantity?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_at: string | null
          household_id: string
          id: string
          recurrence: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_at?: string | null
          household_id: string
          id?: string
          recurrence?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_at?: string | null
          household_id?: string
          id?: string
          recurrence?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string
          direction: string
          household_id: string
          id: string
          merchant: string
          note: string | null
          occurred_on: string
          recurrence_end_on: string | null
          recurrence_group_id: string | null
          recurrence_interval_months: number | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by: string
          direction: string
          household_id: string
          id?: string
          merchant: string
          note?: string | null
          occurred_on?: string
          recurrence_end_on?: string | null
          recurrence_group_id?: string | null
          recurrence_interval_months?: number | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          direction?: string
          household_id?: string
          id?: string
          merchant?: string
          note?: string | null
          occurred_on?: string
          recurrence_end_on?: string | null
          recurrence_group_id?: string | null
          recurrence_interval_months?: number | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_household_id_fkey"
            columns: ["category_id", "household_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          household_id: string
          id: string
          invited_by: string
          revoked_at: string | null
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          household_id: string
          id?: string
          invited_by: string
          revoked_at?: string | null
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          household_id?: string
          id?: string
          invited_by?: string
          revoked_at?: string | null
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invitations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_occurrence_overrides: {
        Row: {
          amount: number | null
          created_at: string
          created_by: string
          household_id: string
          id: string
          is_skipped: boolean
          occurred_on: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          is_skipped?: boolean
          occurred_on: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          is_skipped?: boolean
          occurred_on?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_occurrence_overrides_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_occurrence_overrides_transaction_id_household_id_fkey"
            columns: ["transaction_id", "household_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      transaction_documents: {
        Row: {
          created_at: string
          created_by: string
          document_id: string
          household_id: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          document_id: string
          household_id: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          document_id?: string
          household_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_documents_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_household_invitation: {
        Args: { target_token_hash: string }
        Returns: string
      }
      add_budget_category: {
        Args: {
          p_budget_ids: string[]
          p_category_type: string
          p_color: string
          p_household_id: string
          p_name: string
        }
        Returns: string
      }
      ensure_budget_months: {
        Args: { p_household_id: string; p_months: string[] }
        Returns: undefined
      }
      set_transaction_occurrence_override: {
        Args: {
          p_amount: number | null
          p_household_id: string
          p_occurred_on: string
          p_skip: boolean
          p_transaction_id: string
        }
        Returns: undefined
      }
      split_recurring_transaction: {
        Args: {
          p_amount: number | null
          p_effective_on: string
          p_household_id: string
          p_stop: boolean
          p_transaction_id: string
        }
        Returns: string | null
      }
      update_budget_plans: {
        Args: {
          p_amount: number
          p_budget_ids: string[]
          p_category_id: string
          p_household_id: string
        }
        Returns: undefined
      }
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
    Enums: {},
  },
} as const
