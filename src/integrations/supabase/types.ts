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
      conversations: {
        Row: {
          created_at: string
          id: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      demandas: {
        Row: {
          check_in_at: string | null
          check_in_by: string
          codigo: string
          created_at: string
          data: string
          diarista_id: string | null
          diarista_nome: string
          horario: string
          horario_entrada: string
          horario_saida: string
          id: string
          loja: string
          observacoes: string
          rede: string
          setor: string
          status: string
          tarefas_concluidas: number
          tarefas_total: number
          updated_at: string
          valor: number
        }
        Insert: {
          check_in_at?: string | null
          check_in_by?: string
          codigo?: string
          created_at?: string
          data: string
          diarista_id?: string | null
          diarista_nome?: string
          horario?: string
          horario_entrada?: string
          horario_saida?: string
          id?: string
          loja?: string
          observacoes?: string
          rede?: string
          setor?: string
          status?: string
          tarefas_concluidas?: number
          tarefas_total?: number
          updated_at?: string
          valor?: number
        }
        Update: {
          check_in_at?: string | null
          check_in_by?: string
          codigo?: string
          created_at?: string
          data?: string
          diarista_id?: string | null
          diarista_nome?: string
          horario?: string
          horario_entrada?: string
          horario_saida?: string
          id?: string
          loja?: string
          observacoes?: string
          rede?: string
          setor?: string
          status?: string
          tarefas_concluidas?: number
          tarefas_total?: number
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      diaristas: {
        Row: {
          bairro: string
          cpf: string
          created_at: string
          faltas: number
          id: string
          nome: string
          presencas: number
          setor_experiencia: string[]
          telefone: string
          updated_at: string
        }
        Insert: {
          bairro?: string
          cpf?: string
          created_at?: string
          faltas?: number
          id?: string
          nome: string
          presencas?: number
          setor_experiencia?: string[]
          telefone?: string
          updated_at?: string
        }
        Update: {
          bairro?: string
          cpf?: string
          created_at?: string
          faltas?: number
          id?: string
          nome?: string
          presencas?: number
          setor_experiencia?: string[]
          telefone?: string
          updated_at?: string
        }
        Relationships: []
      }
      lojas: {
        Row: {
          ativo: boolean
          bairro: string
          cidade: string
          created_at: string
          endereco: string
          id: string
          nome: string
          rede: string
          uf: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string
          cidade?: string
          created_at?: string
          endereco?: string
          id?: string
          nome: string
          rede?: string
          uf?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string
          cidade?: string
          created_at?: string
          endereco?: string
          id?: string
          nome?: string
          rede?: string
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          name: string | null
          role: string
          tool_call_id: string | null
          tool_calls: Json | null
          user_id: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          name?: string | null
          role: string
          tool_call_id?: string | null
          tool_calls?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          name?: string | null
          role?: string
          tool_call_id?: string | null
          tool_calls?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rede_valores: {
        Row: {
          created_at: string
          id: string
          rede: string
          updated_at: string
          valor_recebido: number
        }
        Insert: {
          created_at?: string
          id?: string
          rede: string
          updated_at?: string
          valor_recebido?: number
        }
        Update: {
          created_at?: string
          id?: string
          rede?: string
          updated_at?: string
          valor_recebido?: number
        }
        Relationships: []
      }
      registros_financeiros: {
        Row: {
          adiantamento: number
          created_at: string
          custos_adicionais: number
          data: string
          diarista_id: string | null
          diarista_nome: string
          horario_entrada: string
          horario_saida: string
          id: string
          loja: string
          observacoes: string
          pago: boolean
          pago_em: string | null
          passagem: number
          setor: string
          updated_at: string
          valor_diaria: number
        }
        Insert: {
          adiantamento?: number
          created_at?: string
          custos_adicionais?: number
          data: string
          diarista_id?: string | null
          diarista_nome?: string
          horario_entrada?: string
          horario_saida?: string
          id?: string
          loja?: string
          observacoes?: string
          pago?: boolean
          pago_em?: string | null
          passagem?: number
          setor?: string
          updated_at?: string
          valor_diaria?: number
        }
        Update: {
          adiantamento?: number
          created_at?: string
          custos_adicionais?: number
          data?: string
          diarista_id?: string | null
          diarista_nome?: string
          horario_entrada?: string
          horario_saida?: string
          id?: string
          loja?: string
          observacoes?: string
          pago?: boolean
          pago_em?: string | null
          passagem?: number
          setor?: string
          updated_at?: string
          valor_diaria?: number
        }
        Relationships: []
      }
      setor_valores: {
        Row: {
          created_at: string
          id: string
          setor: string
          updated_at: string
          valor_max: number
          valor_min: number
        }
        Insert: {
          created_at?: string
          id?: string
          setor: string
          updated_at?: string
          valor_max?: number
          valor_min?: number
        }
        Update: {
          created_at?: string
          id?: string
          setor?: string
          updated_at?: string
          valor_max?: number
          valor_min?: number
        }
        Relationships: []
      }
      setores_custom: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
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
