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
          notes: string | null
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
          notes?: string | null
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
          notes?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

