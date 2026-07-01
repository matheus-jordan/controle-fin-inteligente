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
      card_expenses: {
        Row: {
          amount: number
          card_id: string
          category_id: string | null
          created_at: string
          current_installment: number
          date: string
          description: string
          id: string
          installments: number
          user_id: string
        }
        Insert: {
          amount: number
          card_id: string
          category_id?: string | null
          created_at?: string
          current_installment?: number
          date?: string
          description: string
          id?: string
          installments?: number
          user_id: string
        }
        Update: {
          amount?: number
          card_id?: string
          category_id?: string | null
          created_at?: string
          current_installment?: number
          date?: string
          description?: string
          id?: string
          installments?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_expenses_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          name: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: []
      }
      credit_cards: {
        Row: {
          closing_day: number | null
          color: string
          created_at: string
          credit_limit: number
          due_day: number | null
          id: string
          last_digits: string | null
          name: string
          user_id: string
        }
        Insert: {
          closing_day?: number | null
          color?: string
          created_at?: string
          credit_limit?: number
          due_day?: number | null
          id?: string
          last_digits?: string | null
          name: string
          user_id: string
        }
        Update: {
          closing_day?: number | null
          color?: string
          created_at?: string
          credit_limit?: number
          due_day?: number | null
          id?: string
          last_digits?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      debts: {
        Row: {
          created_at: string
          debt_kind: string
          duration_months: number | null
          end_date: string | null
          id: string
          installment_amount: number
          interest_rate: number | null
          name: string
          paid_installments: number
          priority: Database["public"]["Enums"]["priority_level"]
          start_date: string
          status: string
          total_amount: number
          total_installments: number
          user_id: string
        }
        Insert: {
          created_at?: string
          debt_kind?: string
          duration_months?: number | null
          end_date?: string | null
          id?: string
          installment_amount: number
          interest_rate?: number | null
          name: string
          paid_installments?: number
          priority?: Database["public"]["Enums"]["priority_level"]
          start_date?: string
          status?: string
          total_amount: number
          total_installments: number
          user_id: string
        }
        Update: {
          created_at?: string
          debt_kind?: string
          duration_months?: number | null
          end_date?: string | null
          id?: string
          installment_amount?: number
          interest_rate?: number | null
          name?: string
          paid_installments?: number
          priority?: Database["public"]["Enums"]["priority_level"]
          start_date?: string
          status?: string
          total_amount?: number
          total_installments?: number
          user_id?: string
        }
        Relationships: []
      }
      fixed_bills: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          due_day: number
          id: string
          is_active: boolean
          name: string
          priority: Database["public"]["Enums"]["priority_level"]
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          due_day: number
          id?: string
          is_active?: boolean
          name: string
          priority?: Database["public"]["Enums"]["priority_level"]
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          due_day?: number
          id?: string
          is_active?: boolean
          name?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_bills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          date: string
          description: string
          due_date: string | null
          id: string
          is_recurring: boolean
          priority: Database["public"]["Enums"]["priority_level"]
          recurrence_end_date: string | null
          recurrence_interval:
            | Database["public"]["Enums"]["recurrence_interval"]
            | null
          status: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          date?: string
          description: string
          due_date?: string | null
          id?: string
          is_recurring?: boolean
          priority?: Database["public"]["Enums"]["priority_level"]
          recurrence_end_date?: string | null
          recurrence_interval?:
            | Database["public"]["Enums"]["recurrence_interval"]
            | null
          status?: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          date?: string
          description?: string
          due_date?: string | null
          id?: string
          is_recurring?: boolean
          priority?: Database["public"]["Enums"]["priority_level"]
          recurrence_end_date?: string | null
          recurrence_interval?:
            | Database["public"]["Enums"]["recurrence_interval"]
            | null
          status?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          alert_days_before: number
          created_at: string
          id: string
          monthly_income_goal: number | null
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_days_before?: number
          created_at?: string
          id?: string
          monthly_income_goal?: number | null
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_days_before?: number
          created_at?: string
          id?: string
          monthly_income_goal?: number | null
          theme?: string
          updated_at?: string
          user_id?: string
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
      priority_level: "essential" | "critical" | "important" | "optional"
      recurrence_interval: "monthly" | "weekly" | "biweekly" | "yearly"
      transaction_type: "income" | "expense"
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
      priority_level: ["essential", "critical", "important", "optional"],
      recurrence_interval: ["monthly", "weekly", "biweekly", "yearly"],
      transaction_type: ["income", "expense"],
    },
  },
} as const
