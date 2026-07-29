export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  nutricionista: {
    Tables: {
      documentos: {
        Row: {
          id: string
          nombre: string
          carpeta: string
          url: string | null
          orden: number | null
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          carpeta: string
          url?: string | null
          orden?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          carpeta?: string
          url?: string | null
          orden?: number | null
          created_at?: string
        }
      }
      tarjetas: {
        Row: {
          id: string
          documento_id: string
          titulo: string
          contenido: string
          orden: number
          created_at: string
        }
        Insert: {
          id?: string
          documento_id: string
          titulo: string
          contenido: string
          orden?: number
          created_at?: string
        }
        Update: {
          id?: string
          documento_id?: string
          titulo?: string
          contenido?: string
          orden?: number
          created_at?: string
        }
      }
      tracking: {
        Row: {
          id: string
          event_name: string
          details: Json
          timestamp: string
        }
        Insert: {
          id?: string
          event_name: string
          details?: Json
          timestamp?: string
        }
        Update: {
          id?: string
          event_name?: string
          details?: Json
          timestamp?: string
        }
      }
    }
  }
}
