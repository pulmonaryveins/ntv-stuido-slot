// Mirrors `supabase gen types typescript` output for the public schema.
// Regenerate with `npm run db:types` once the project is linked.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type SlotRow = {
  id: number
  account_id: number
  slot_number: number
  user_id: string | null
  status: Database['public']['Enums']['slot_status'] | null
  claimed_at: string | null
  expected_until: string | null
  render_eta: string | null
  hold_user_id: string | null
  hold_until: string | null
  prev_status: Database['public']['Enums']['slot_status'] | null
  break_until: string | null
  /** Adobe device name of the computer using this seat (null when free). */
  device_name: string | null
}

type ProfileRow = {
  id: string
  name: string
  role: Database['public']['Enums']['app_role']
  work_role: Database['public']['Enums']['work_role']
  active: boolean
  avatar_color: string
  /** The user's remembered Adobe device name. */
  device_name: string | null
  created_at: string
}

type AccountRow = { id: number; label: string }

type SettingsRow = {
  id: boolean
  max_session_min: number
  hold_minutes: number
  break_minutes: number
}

// Clients never write tables directly (RLS + grants allow SELECT only).
type ReadOnly<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] }

export type Database = {
  public: {
    Tables: {
      profiles: ReadOnly<ProfileRow>
      accounts: ReadOnly<AccountRow>
      slots: ReadOnly<SlotRow>
      queue: ReadOnly<{ id: number; user_id: string; joined_at: string }>
      activity_log: ReadOnly<{
        id: number
        slot_id: number | null
        user_id: string | null
        action: string
        meta: Json
        created_at: string
      }>
      settings: ReadOnly<SettingsRow>
    }
    Views: { [_ in never]: never }
    Functions: {
      claim_slot: {
        Args: {
          p_slot_id: number
          p_status: Database['public']['Enums']['slot_status']
          p_minutes: number
          p_device_name?: string | null
        }
        Returns: SlotRow
      }
      set_slot_device: { Args: { p_slot_id: number; p_device_name: string }; Returns: SlotRow }
      release_slot: { Args: { p_slot_id: number }; Returns: undefined }
      extend_slot: { Args: { p_slot_id: number; p_minutes: number }; Returns: SlotRow }
      set_status: {
        Args: {
          p_slot_id: number
          p_status: Database['public']['Enums']['slot_status']
          p_render_eta?: string | null
        }
        Returns: SlotRow
      }
      start_break: { Args: { p_slot_id: number }; Returns: SlotRow }
      end_break: { Args: { p_slot_id: number }; Returns: SlotRow }
      join_queue: { Args: Record<PropertyKey, never>; Returns: undefined }
      leave_queue: { Args: Record<PropertyKey, never>; Returns: undefined }
      knock: { Args: { p_slot_id: number }; Returns: undefined }
      device_name_available: { Args: { p_name: string }; Returns: boolean }
      update_my_profile: {
        Args: {
          p_name?: string | null
          p_work_role?: Database['public']['Enums']['work_role'] | null
          p_avatar_color?: string | null
          p_device_name?: string | null
        }
        Returns: ProfileRow
      }
      admin_force_release: { Args: { p_slot_id: number }; Returns: undefined }
      admin_remove_from_queue: { Args: { p_user_id: string }; Returns: undefined }
      admin_update_profile: {
        Args: {
          p_user_id: string
          p_role?: Database['public']['Enums']['app_role'] | null
          p_active?: boolean | null
          p_work_role?: Database['public']['Enums']['work_role'] | null
          p_name?: string | null
        }
        Returns: ProfileRow
      }
      admin_delete_user: { Args: { p_user_id: string }; Returns: undefined }
      admin_update_account: { Args: { p_account_id: number; p_label: string }; Returns: AccountRow }
      admin_update_settings: {
        Args: {
          p_max_session_min?: number | null
          p_hold_minutes?: number | null
          p_break_minutes?: number | null
        }
        Returns: SettingsRow
      }
    }
    Enums: {
      app_role: 'admin' | 'user'
      work_role: 'editor' | 'designer' | 'motion'
      slot_status: 'designing' | 'editing' | 'color_grading' | 'motion' | 'rendering' | 'break'
    }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
