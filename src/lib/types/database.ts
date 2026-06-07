export type CampaignRole = "dm" | "player";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Campaign {
  id: string;
  name: string;
  created_by: string;
  party_data: Json;
  created_at: string;
  updated_at: string;
}

export interface CampaignMember {
  id: string;
  campaign_id: string;
  user_id: string;
  role: CampaignRole;
  created_at: string;
}

export interface Character {
  id: string;
  campaign_id: string;
  name: string;
  player_name: string;
  data: Json;
  created_at: string;
  updated_at: string;
}

export interface Encounter {
  id: string;
  campaign_id: string;
  name: string;
  round: number;
  current_turn_index: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EncounterCombatant {
  id: string;
  encounter_id: string;
  character_id: string | null;
  data: Json;
  initiative: number;
  sort_order: number;
  visible_to_players: boolean;
  created_at: string;
  updated_at: string;
}

export type Database = {
  public: {
    Tables: {
      campaigns: {
        Row: Campaign;
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          party_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Campaign>;
        Relationships: [];
      };
      campaign_members: {
        Row: CampaignMember;
        Insert: {
          id?: string;
          campaign_id: string;
          user_id: string;
          role: CampaignRole;
          created_at?: string;
        };
        Update: Partial<CampaignMember>;
        Relationships: [];
      };
      characters: {
        Row: Character;
        Insert: {
          id?: string;
          campaign_id: string;
          name: string;
          player_name?: string;
          data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Character>;
        Relationships: [];
      };
      encounters: {
        Row: Encounter;
        Insert: {
          id?: string;
          campaign_id: string;
          name?: string;
          round?: number;
          current_turn_index?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Encounter>;
        Relationships: [];
      };
      encounter_combatants: {
        Row: EncounterCombatant;
        Insert: {
          id?: string;
          encounter_id: string;
          character_id?: string | null;
          data?: Json;
          initiative?: number;
          sort_order?: number;
          visible_to_players?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<EncounterCombatant>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export interface CampaignContext {
  campaign: Campaign;
  role: CampaignRole;
  isDm: boolean;
}
