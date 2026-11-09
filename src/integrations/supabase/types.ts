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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          id: number
          kur: string
          rekordi_id: string | null
          tabela: string
          te_rejat: Json | null
          te_vjetra: Json | null
          user_id: string | null
          veprimi: string
        }
        Insert: {
          id?: never
          kur?: string
          rekordi_id?: string | null
          tabela: string
          te_rejat?: Json | null
          te_vjetra?: Json | null
          user_id?: string | null
          veprimi: string
        }
        Update: {
          id?: never
          kur?: string
          rekordi_id?: string | null
          tabela?: string
          te_rejat?: Json | null
          te_vjetra?: Json | null
          user_id?: string | null
          veprimi?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          emer: string
          id: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          emer: string
          id?: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          emer?: string
          id?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      class_groups: {
        Row: {
          created_at: string
          curriculum_id: string | null
          department_id: string | null
          emer: string
          id: string
          nivel: number
          school_year_id: string
        }
        Insert: {
          created_at?: string
          curriculum_id?: string | null
          department_id?: string | null
          emer: string
          id?: string
          nivel: number
          school_year_id: string
        }
        Update: {
          created_at?: string
          curriculum_id?: string | null
          department_id?: string | null
          emer?: string
          id?: string
          nivel?: number
          school_year_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_groups_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_groups_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_groups_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      curricula: {
        Row: {
          created_at: string
          department_id: string
          drejtimi: string | null
          emer: string
          id: string
          kod: string
          niveli: string | null
          profili: string | null
          shenim: string | null
        }
        Insert: {
          created_at?: string
          department_id: string
          drejtimi?: string | null
          emer: string
          id?: string
          kod: string
          niveli?: string | null
          profili?: string | null
          shenim?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string
          drejtimi?: string | null
          emer?: string
          id?: string
          kod?: string
          niveli?: string | null
          profili?: string | null
          shenim?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curricula_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          emer: string
          id: string
          kod: string
        }
        Insert: {
          created_at?: string
          emer: string
          id?: string
          kod: string
        }
        Update: {
          created_at?: string
          emer?: string
          id?: string
          kod?: string
        }
        Relationships: []
      }
      homeroom_assignments: {
        Row: {
          aktiv: boolean
          class_group_id: string
          created_at: string
          id: string
          school_year_id: string
          teacher_id: string
        }
        Insert: {
          aktiv?: boolean
          class_group_id: string
          created_at?: string
          id?: string
          school_year_id: string
          teacher_id: string
        }
        Update: {
          aktiv?: boolean
          class_group_id?: string
          created_at?: string
          id?: string
          school_year_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homeroom_assignments_class_group_id_fkey"
            columns: ["class_group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeroom_assignments_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeroom_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          created_at: string
          id: string
          lloji: string
          raport_gabimesh: Json
          rreshta_gabim: number
          rreshta_ok: number
          skedari: string
          statusi: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lloji: string
          raport_gabimesh?: Json
          rreshta_gabim?: number
          rreshta_ok?: number
          skedari: string
          statusi?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lloji?: string
          raport_gabimesh?: Json
          rreshta_gabim?: number
          rreshta_ok?: number
          skedari?: string
          statusi?: string
          user_id?: string
        }
        Relationships: []
      }
      item_suggestions: {
        Row: {
          arsye: string | null
          created_at: string
          emer: string
          id: string
          item_id: string | null
          njesia: string | null
          shenim_admin: string | null
          shqyrtuar_me: string | null
          shqyrtuar_nga: string | null
          specifikime: string | null
          statusi: Database["public"]["Enums"]["suggestion_status"]
          sugjeruar_nga: string
        }
        Insert: {
          arsye?: string | null
          created_at?: string
          emer: string
          id?: string
          item_id?: string | null
          njesia?: string | null
          shenim_admin?: string | null
          shqyrtuar_me?: string | null
          shqyrtuar_nga?: string | null
          specifikime?: string | null
          statusi?: Database["public"]["Enums"]["suggestion_status"]
          sugjeruar_nga?: string
        }
        Update: {
          arsye?: string | null
          created_at?: string
          emer?: string
          id?: string
          item_id?: string | null
          njesia?: string | null
          shenim_admin?: string | null
          shqyrtuar_me?: string | null
          shqyrtuar_nga?: string | null
          specifikime?: string | null
          statusi?: Database["public"]["Enums"]["suggestion_status"]
          sugjeruar_nga?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_suggestions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_synonyms: {
        Row: {
          created_at: string
          id: string
          item_id: string
          sinonim: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          sinonim: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          sinonim?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_synonyms_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          aktiv: boolean
          category_id: string | null
          cmim_reference: number | null
          created_at: string
          emer: string
          id: string
          kod: string
          specifikime: string | null
          unit_id: string
        }
        Insert: {
          aktiv?: boolean
          category_id?: string | null
          cmim_reference?: number | null
          created_at?: string
          emer: string
          id?: string
          kod?: string
          specifikime?: string | null
          unit_id: string
        }
        Update: {
          aktiv?: boolean
          category_id?: string | null
          cmim_reference?: number | null
          created_at?: string
          emer?: string
          id?: string
          kod?: string
          specifikime?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_assignments: {
        Row: {
          aktiv: boolean
          created_at: string
          id: string
          laboratory_id: string
          school_year_id: string
          teacher_id: string
        }
        Insert: {
          aktiv?: boolean
          created_at?: string
          id?: string
          laboratory_id: string
          school_year_id: string
          teacher_id: string
        }
        Update: {
          aktiv?: boolean
          created_at?: string
          id?: string
          laboratory_id?: string
          school_year_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_assignments_laboratory_id_fkey"
            columns: ["laboratory_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_assignments_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      laboratories: {
        Row: {
          created_at: string
          department_id: string | null
          emer: string
          id: string
          pershkrim: string | null
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          emer: string
          id?: string
          pershkrim?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string | null
          emer?: string
          id?: string
          pershkrim?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laboratories_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          mesazhi: string
          read_at: string | null
          request_id: string
          titulli: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mesazhi: string
          read_at?: string | null
          request_id: string
          titulli: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mesazhi?: string
          read_at?: string | null
          request_id?: string
          titulli?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_role_grants: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          teacher_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          teacher_id: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_role_grants_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_role_grants_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          emer_shfaqur: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          emer_shfaqur?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          emer_shfaqur?: string | null
          user_id?: string
        }
        Relationships: []
      }
      request_comments: {
        Row: {
          autor: string
          created_at: string
          id: string
          lloji: Database["public"]["Enums"]["comment_type"]
          request_id: string
          tekst: string
        }
        Insert: {
          autor?: string
          created_at?: string
          id?: string
          lloji?: Database["public"]["Enums"]["comment_type"]
          request_id: string
          tekst: string
        }
        Update: {
          autor?: string
          created_at?: string
          id?: string
          lloji?: Database["public"]["Enums"]["comment_type"]
          request_id?: string
          tekst?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_decisions: {
        Row: {
          arsye: string | null
          id: string
          kur: string
          request_id: string
          vendimi: Database["public"]["Enums"]["request_status"]
          vendosur_nga: string
        }
        Insert: {
          arsye?: string | null
          id?: string
          kur?: string
          request_id: string
          vendimi: Database["public"]["Enums"]["request_status"]
          vendosur_nga: string
        }
        Update: {
          arsye?: string | null
          id?: string
          kur?: string
          request_id?: string
          vendimi?: Database["public"]["Enums"]["request_status"]
          vendosur_nga?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_decisions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_lines: {
        Row: {
          cmim_njesi: number | null
          created_at: string
          id: string
          item_id: string
          request_id: string
          sasia: number
          sasia_dorezuar: number
          sasia_miratuar: number | null
          shenim: string | null
          vlera: number | null
        }
        Insert: {
          cmim_njesi?: number | null
          created_at?: string
          id?: string
          item_id: string
          request_id: string
          sasia: number
          sasia_dorezuar?: number
          sasia_miratuar?: number | null
          shenim?: string | null
          vlera?: number | null
        }
        Update: {
          cmim_njesi?: number | null
          created_at?: string
          id?: string
          item_id?: string
          request_id?: string
          sasia?: number
          sasia_dorezuar?: number
          sasia_miratuar?: number | null
          shenim?: string | null
          vlera?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "request_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_lines_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_status_history: {
        Row: {
          id: number
          kur: string
          ne: Database["public"]["Enums"]["request_status"]
          nga: Database["public"]["Enums"]["request_status"] | null
          nga_kush: string | null
          request_id: string
        }
        Insert: {
          id?: never
          kur?: string
          ne: Database["public"]["Enums"]["request_status"]
          nga?: Database["public"]["Enums"]["request_status"] | null
          nga_kush?: string | null
          request_id: string
        }
        Update: {
          id?: never
          kur?: string
          ne?: Database["public"]["Enums"]["request_status"]
          nga?: Database["public"]["Enums"]["request_status"] | null
          nga_kush?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          arsyetimi: string | null
          class_group_id: string | null
          created_at: string
          curriculum_id: string | null
          department_id: string | null
          derguar_me: string | null
          id: string
          konteksti: Database["public"]["Enums"]["request_context"]
          krijuar_nga: string
          laboratory_id: string | null
          numer: string
          school_year_id: string
          statusi: Database["public"]["Enums"]["request_status"]
          subject_id: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          arsyetimi?: string | null
          class_group_id?: string | null
          created_at?: string
          curriculum_id?: string | null
          department_id?: string | null
          derguar_me?: string | null
          id?: string
          konteksti: Database["public"]["Enums"]["request_context"]
          krijuar_nga?: string
          laboratory_id?: string | null
          numer?: string
          school_year_id: string
          statusi?: Database["public"]["Enums"]["request_status"]
          subject_id?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          arsyetimi?: string | null
          class_group_id?: string | null
          created_at?: string
          curriculum_id?: string | null
          department_id?: string | null
          derguar_me?: string | null
          id?: string
          konteksti?: Database["public"]["Enums"]["request_context"]
          krijuar_nga?: string
          laboratory_id?: string | null
          numer?: string
          school_year_id?: string
          statusi?: Database["public"]["Enums"]["request_status"]
          subject_id?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_class_group_id_fkey"
            columns: ["class_group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_laboratory_id_fkey"
            columns: ["laboratory_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      school_years: {
        Row: {
          aktiv: boolean
          created_at: string
          data_fillimi: string | null
          data_mbarimi: string | null
          emer: string
          id: string
        }
        Insert: {
          aktiv?: boolean
          created_at?: string
          data_fillimi?: string | null
          data_mbarimi?: string | null
          emer: string
          id?: string
        }
        Update: {
          aktiv?: boolean
          created_at?: string
          data_fillimi?: string | null
          data_mbarimi?: string | null
          emer?: string
          id?: string
        }
        Relationships: []
      }
      stock_balances: {
        Row: {
          item_id: string
          perditesuar_me: string
          sasia: number
        }
        Insert: {
          item_id: string
          perditesuar_me?: string
          sasia?: number
        }
        Update: {
          item_id?: string
          perditesuar_me?: string
          sasia?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_balances_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          arsye: string | null
          bilanci_pas: number
          cmim_njesi: number | null
          dokument: string | null
          id: number
          item_id: string
          kryer_nga: string
          kur: string
          lloji: Database["public"]["Enums"]["stock_movement_type"]
          request_line_id: string | null
          sasia: number
        }
        Insert: {
          arsye?: string | null
          bilanci_pas: number
          cmim_njesi?: number | null
          dokument?: string | null
          id?: never
          item_id: string
          kryer_nga: string
          kur?: string
          lloji: Database["public"]["Enums"]["stock_movement_type"]
          request_line_id?: string | null
          sasia: number
        }
        Update: {
          arsye?: string | null
          bilanci_pas?: number
          cmim_njesi?: number | null
          dokument?: string | null
          id?: never
          item_id?: string
          kryer_nga?: string
          kur?: string
          lloji?: Database["public"]["Enums"]["stock_movement_type"]
          request_line_id?: string | null
          sasia?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_request_line_id_fkey"
            columns: ["request_line_id"]
            isOneToOne: false
            referencedRelation: "request_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          curriculum_id: string | null
          emer: string
          id: string
          klasa_nivel: number | null
          kod: string | null
          lloji: Database["public"]["Enums"]["subject_type"] | null
        }
        Insert: {
          created_at?: string
          curriculum_id?: string | null
          emer: string
          id?: string
          klasa_nivel?: number | null
          kod?: string | null
          lloji?: Database["public"]["Enums"]["subject_type"] | null
        }
        Update: {
          created_at?: string
          curriculum_id?: string | null
          emer?: string
          id?: string
          klasa_nivel?: number | null
          kod?: string | null
          lloji?: Database["public"]["Enums"]["subject_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          aktiv: boolean
          created_at: string
          department_id: string | null
          email: string | null
          emer: string
          id: string
          lendet_sipas_listes: string | null
          mbiemer: string | null
          user_id: string | null
        }
        Insert: {
          aktiv?: boolean
          created_at?: string
          department_id?: string | null
          email?: string | null
          emer: string
          id?: string
          lendet_sipas_listes?: string | null
          mbiemer?: string | null
          user_id?: string | null
        }
        Update: {
          aktiv?: boolean
          created_at?: string
          department_id?: string | null
          email?: string | null
          emer?: string
          id?: string
          lendet_sipas_listes?: string | null
          mbiemer?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_assignments: {
        Row: {
          aktiv: boolean
          class_group_id: string
          created_at: string
          id: string
          school_year_id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          aktiv?: boolean
          class_group_id: string
          created_at?: string
          id?: string
          school_year_id: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          aktiv?: boolean
          class_group_id?: string
          created_at?: string
          id?: string
          school_year_id?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_assignments_class_group_id_fkey"
            columns: ["class_group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_assignments_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string
          emer: string
          id: string
          kod: string
        }
        Insert: {
          created_at?: string
          emer: string
          id?: string
          kod: string
        }
        Update: {
          created_at?: string
          emer?: string
          id?: string
          kod?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_request: {
        Args: { _req: string; _uid: string }
        Returns: boolean
      }
      commit_excel_import: {
        Args: { _filename: string; _kind: string; _rows: Json }
        Returns: undefined
      }
      dashboard_summary: { Args: never; Returns: Json }
      decide_request: {
        Args: { _arsye?: string; _id: string; _lines?: Json; _vendimi: string }
        Returns: Database["public"]["Enums"]["request_status"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      heads_department: {
        Args: { _dept: string; _user_id: string }
        Returns: boolean
      }
      record_stock_movement: {
        Args: {
          _arsye?: string
          _cmim_njesi?: number
          _dokument?: string
          _item_id: string
          _lloji: string
          _request_line_id?: string
          _sasia: number
        }
        Returns: number
      }
      request_editable_by: {
        Args: { _req: string; _uid: string }
        Returns: boolean
      }
      review_suggestion: {
        Args: {
          _category_id?: string
          _emer?: string
          _id: string
          _item_id?: string
          _shenim?: string
          _specifikime?: string
          _unit_id?: string
          _veprimi: string
        }
        Returns: string
      }
      search_items: {
        Args: { _limit?: number; _q: string }
        Returns: {
          aktiv: boolean
          cmim_reference: number
          emer: string
          id: string
          kategoria: string
          kod: string
          njesia: string
          score: number
          sinonime: string[]
          specifikime: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_request: { Args: { _id: string }; Returns: undefined }
      teacher_id_of: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "shef_departamenti" | "mesues" | "magazinier"
      comment_type: "koment" | "rekomandim"
      request_context:
        | "teori_pergjithshme"
        | "teori_profesionale"
        | "praktike_profesionale"
        | "kujdestari"
        | "laborator"
      request_status:
        | "draft"
        | "derguar"
        | "kthyer_per_korrigjim"
        | "miratuar"
        | "miratuar_pjeserisht"
        | "refuzuar"
        | "ne_permbushje"
        | "permbushur"
        | "mbyllur"
      stock_movement_type:
        | "inventar_fillestar"
        | "hyrje"
        | "dalje"
        | "kthim"
        | "korrigjim"
      subject_type:
        | "teori_pergjithshme"
        | "teori_profesionale"
        | "praktike_profesionale"
      suggestion_status: "ne_shqyrtim" | "pranuar" | "bashkuar" | "refuzuar"
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
      app_role: ["admin", "shef_departamenti", "mesues", "magazinier"],
      comment_type: ["koment", "rekomandim"],
      request_context: [
        "teori_pergjithshme",
        "teori_profesionale",
        "praktike_profesionale",
        "kujdestari",
        "laborator",
      ],
      request_status: [
        "draft",
        "derguar",
        "kthyer_per_korrigjim",
        "miratuar",
        "miratuar_pjeserisht",
        "refuzuar",
        "ne_permbushje",
        "permbushur",
        "mbyllur",
      ],
      stock_movement_type: [
        "inventar_fillestar",
        "hyrje",
        "dalje",
        "kthim",
        "korrigjim",
      ],
      subject_type: [
        "teori_pergjithshme",
        "teori_profesionale",
        "praktike_profesionale",
      ],
      suggestion_status: ["ne_shqyrtim", "pranuar", "bashkuar", "refuzuar"],
    },
  },
} as const
