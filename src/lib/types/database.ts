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
  world_data: Json;
  maps_data: Json;
  notables_data: Json;
  soulmonger_data: Json;
  combat_state: Json;
  is_main: boolean;
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
  owner_user_id: string | null;
  data: Json;
  created_at: string;
  updated_at: string;
}

export interface Enemy {
  id: string;
  slug: string;
  name: string;
  source: string;
  data: Json;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  slug: string;
  name: string;
  category: string;
  subcategory: string | null;
  source: string;
  rarity: string;
  weight_lb: number | null;
  cost_gp: number | null;
  description: string;
  properties: Json;
  requires_attunement: boolean;
  is_magic: boolean;
  created_at: string;
  updated_at: string;
}

export interface CampaignNotebook {
  id: string;
  user_id: string;
  campaign_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignCalendarEvent {
  id: string;
  campaign_id: string;
  title: string;
  description: string;
  source: string;
  location: string;
  event_time: string | null;
  all_day: boolean;
  month: number;
  day: number;
  festival: string | null;
  year: number | null;
  repeat_rule: string;
  created_by: string;
  attribution: string;
  created_at: string;
  updated_at: string;
}

export interface Encounter {
  id: string;
  name: string;
  background_path: string | null;
  grid_width: number;
  grid_height: number;
  tile_feet: number;
  blocked_cells: Json;
  data: Json;
  total_cr: number;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use Encounter */
export type SavedEncounter = Encounter;

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
          world_data?: Json;
          maps_data?: Json;
          notables_data?: Json;
          soulmonger_data?: Json;
          combat_state?: Json;
          is_main?: boolean;
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
          owner_user_id?: string | null;
          data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Character>;
        Relationships: [];
      };
      items: {
        Row: Item;
        Insert: {
          id?: string;
          slug: string;
          name: string;
          category?: string;
          subcategory?: string | null;
          source?: string;
          rarity?: string;
          weight_lb?: number | null;
          cost_gp?: number | null;
          description?: string;
          properties?: Json;
          requires_attunement?: boolean;
          is_magic?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Item>;
        Relationships: [];
      };
      enemies: {
        Row: Enemy;
        Insert: {
          id?: string;
          slug: string;
          name: string;
          source?: string;
          data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Enemy>;
        Relationships: [];
      };
      campaign_notebooks: {
        Row: CampaignNotebook;
        Insert: {
          id?: string;
          user_id: string;
          campaign_id: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<CampaignNotebook>;
        Relationships: [];
      };
      campaign_calendar_events: {
        Row: CampaignCalendarEvent;
        Insert: {
          id?: string;
          campaign_id: string;
          title: string;
          description?: string;
          source?: string;
          location?: string;
          event_time?: string | null;
          all_day?: boolean;
          month: number;
          day: number;
          festival?: string | null;
          year?: number | null;
          repeat_rule?: string;
          created_by: string;
          attribution?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<CampaignCalendarEvent>;
        Relationships: [];
      };
      encounters: {
        Row: Encounter;
        Insert: {
          id?: string;
          name: string;
          background_path?: string | null;
          grid_width?: number;
          grid_height?: number;
          tile_feet?: number;
          blocked_cells?: Json;
          data?: Json;
          total_cr?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Encounter>;
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
