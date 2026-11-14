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
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_by: string | null
          created_date: string
          details: string | null
          id: string
          target_id: string | null
          target_type: string | null
          updated_date: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_by?: string | null
          created_date?: string
          details?: string | null
          id?: string
          target_id?: string | null
          target_type?: string | null
          updated_date?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_by?: string | null
          created_date?: string
          details?: string | null
          id?: string
          target_id?: string | null
          target_type?: string | null
          updated_date?: string
        }
        Relationships: []
      }
      admin_capabilities: {
        Row: {
          category: string
          created_date: string
          description: string | null
          key: string
          label: string
          min_level: number
          sort_order: number
          updated_date: string
        }
        Insert: {
          category?: string
          created_date?: string
          description?: string | null
          key: string
          label: string
          min_level?: number
          sort_order?: number
          updated_date?: string
        }
        Update: {
          category?: string
          created_date?: string
          description?: string | null
          key?: string
          label?: string
          min_level?: number
          sort_order?: number
          updated_date?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          active: boolean
          created_by: string | null
          created_date: string
          id: string
          key: string
          last_used: string | null
          name: string
          scopes: string | null
          updated_date: string
        }
        Insert: {
          active?: boolean
          created_by?: string | null
          created_date?: string
          id?: string
          key: string
          last_used?: string | null
          name: string
          scopes?: string | null
          updated_date?: string
        }
        Update: {
          active?: boolean
          created_by?: string | null
          created_date?: string
          id?: string
          key?: string
          last_used?: string | null
          name?: string
          scopes?: string | null
          updated_date?: string
        }
        Relationships: []
      }
      auction_cost_items: {
        Row: {
          amount: number
          auction_id: string
          created_by: string | null
          created_date: string
          id: string
          kind: string
          label: string
          notes: string | null
          updated_date: string
        }
        Insert: {
          amount?: number
          auction_id: string
          created_by?: string | null
          created_date?: string
          id?: string
          kind?: string
          label: string
          notes?: string | null
          updated_date?: string
        }
        Update: {
          amount?: number
          auction_id?: string
          created_by?: string | null
          created_date?: string
          id?: string
          kind?: string
          label?: string
          notes?: string | null
          updated_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_cost_items_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_cost_items_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_finance_changes: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          auction_id: string
          created_by: string | null
          created_date: string
          field: string
          id: string
          new_value: string | null
          note: string | null
          old_value: string | null
          updated_date: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          auction_id: string
          created_by?: string | null
          created_date?: string
          field: string
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          updated_date?: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          auction_id?: string
          created_by?: string | null
          created_date?: string
          field?: string
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          updated_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_finance_changes_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_finance_changes_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_finance_overrides: {
        Row: {
          auction_id: string
          cost_price: number | null
          created_by: string | null
          created_date: string
          id: string
          income_adjust: number
          note: string | null
          other_cost: number | null
          updated_date: string
        }
        Insert: {
          auction_id: string
          cost_price?: number | null
          created_by?: string | null
          created_date?: string
          id?: string
          income_adjust?: number
          note?: string | null
          other_cost?: number | null
          updated_date?: string
        }
        Update: {
          auction_id?: string
          cost_price?: number | null
          created_by?: string | null
          created_date?: string
          id?: string
          income_adjust?: number
          note?: string | null
          other_cost?: number | null
          updated_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_finance_overrides_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: true
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_finance_overrides_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: true
            referencedRelation: "auctions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_messages: {
        Row: {
          auction_id: string
          author_name: string | null
          body: string
          created_date: string
          id: string
          updated_date: string
          user_id: string
        }
        Insert: {
          auction_id: string
          author_name?: string | null
          body: string
          created_date?: string
          id?: string
          updated_date?: string
          user_id?: string
        }
        Update: {
          auction_id?: string
          author_name?: string | null
          body?: string
          created_date?: string
          id?: string
          updated_date?: string
          user_id?: string
        }
        Relationships: []
      }
      auctions: {
        Row: {
          anti_snipe_seconds: number
          bid_fee: number
          bid_increment: number
          bid_rate_limit: number
          bid_rate_window_minutes: number
          bids_per_participant: number
          brand_id: string | null
          category_id: string | null
          cost_price: number
          created_by: string | null
          created_date: string
          current_price: number
          description: string | null
          duration_minutes: number
          end_time: string | null
          entry_fee: number
          extra_bid_price: number
          featured: boolean
          featured_order: number
          focal_x: number | null
          focal_y: number | null
          highest_bidder_id: string | null
          hold_retry_minutes: number
          id: string
          image_height: number | null
          image_url: string | null
          image_width: number | null
          max_restarts: number
          max_subscribers: number
          min_participants: number | null
          min_round_minutes: number
          mode: string
          other_cost: number
          paid: boolean
          pool_warn_pct: number
          restart_count: number
          round: number
          scheduled_start_time: string | null
          start_price: number
          start_time: string | null
          status: string
          subscriber_count: number
          subscriber_ids: string[]
          target_price: number | null
          title: string
          updated_date: string
          winner_id: string | null
          winner_name: string | null
          winner_notified: boolean
        }
        Insert: {
          anti_snipe_seconds?: number
          bid_fee?: number
          bid_increment?: number
          bid_rate_limit?: number
          bid_rate_window_minutes?: number
          bids_per_participant?: number
          brand_id?: string | null
          category_id?: string | null
          cost_price?: number
          created_by?: string | null
          created_date?: string
          current_price?: number
          description?: string | null
          duration_minutes?: number
          end_time?: string | null
          entry_fee?: number
          extra_bid_price?: number
          featured?: boolean
          featured_order?: number
          focal_x?: number | null
          focal_y?: number | null
          highest_bidder_id?: string | null
          hold_retry_minutes?: number
          id?: string
          image_height?: number | null
          image_url?: string | null
          image_width?: number | null
          max_restarts?: number
          max_subscribers?: number
          min_participants?: number | null
          min_round_minutes?: number
          mode?: string
          other_cost?: number
          paid?: boolean
          pool_warn_pct?: number
          restart_count?: number
          round?: number
          scheduled_start_time?: string | null
          start_price?: number
          start_time?: string | null
          status?: string
          subscriber_count?: number
          subscriber_ids?: string[]
          target_price?: number | null
          title: string
          updated_date?: string
          winner_id?: string | null
          winner_name?: string | null
          winner_notified?: boolean
        }
        Update: {
          anti_snipe_seconds?: number
          bid_fee?: number
          bid_increment?: number
          bid_rate_limit?: number
          bid_rate_window_minutes?: number
          bids_per_participant?: number
          brand_id?: string | null
          category_id?: string | null
          cost_price?: number
          created_by?: string | null
          created_date?: string
          current_price?: number
          description?: string | null
          duration_minutes?: number
          end_time?: string | null
          entry_fee?: number
          extra_bid_price?: number
          featured?: boolean
          featured_order?: number
          focal_x?: number | null
          focal_y?: number | null
          highest_bidder_id?: string | null
          hold_retry_minutes?: number
          id?: string
          image_height?: number | null
          image_url?: string | null
          image_width?: number | null
          max_restarts?: number
          max_subscribers?: number
          min_participants?: number | null
          min_round_minutes?: number
          mode?: string
          other_cost?: number
          paid?: boolean
          pool_warn_pct?: number
          restart_count?: number
          round?: number
          scheduled_start_time?: string | null
          start_price?: number
          start_time?: string | null
          status?: string
          subscriber_count?: number
          subscriber_ids?: string[]
          target_price?: number | null
          title?: string
          updated_date?: string
          winner_id?: string | null
          winner_name?: string | null
          winner_notified?: boolean
        }
        Relationships: []
      }
      bid_credits: {
        Row: {
          auction_id: string
          created_date: string
          credits: number
          id: string
          round: number
          updated_date: string
          user_id: string
        }
        Insert: {
          auction_id: string
          created_date?: string
          credits?: number
          id?: string
          round?: number
          updated_date?: string
          user_id: string
        }
        Update: {
          auction_id?: string
          created_date?: string
          credits?: number
          id?: string
          round?: number
          updated_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_credits_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_credits_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_events: {
        Row: {
          amount: number | null
          auction_id: string | null
          created_date: string
          details: Json
          event: string
          id: string
          latency_ms: number | null
          mode: string | null
          outcome: string
          price_after: number | null
          price_before: number | null
          reason: string | null
          round: number | null
          severity: string
          updated_date: string
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          auction_id?: string | null
          created_date?: string
          details?: Json
          event: string
          id?: string
          latency_ms?: number | null
          mode?: string | null
          outcome: string
          price_after?: number | null
          price_before?: number | null
          reason?: string | null
          round?: number | null
          severity?: string
          updated_date?: string
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          auction_id?: string | null
          created_date?: string
          details?: Json
          event?: string
          id?: string
          latency_ms?: number | null
          mode?: string | null
          outcome?: string
          price_after?: number | null
          price_before?: number | null
          reason?: string | null
          round?: number | null
          severity?: string
          updated_date?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bid_holds: {
        Row: {
          amount: number
          auction_id: string
          created_date: string
          id: string
          reason: string | null
          released_at: string | null
          retry_until: string | null
          round: number
          status: string
          updated_date: string
          user_id: string
        }
        Insert: {
          amount?: number
          auction_id: string
          created_date?: string
          id?: string
          reason?: string | null
          released_at?: string | null
          retry_until?: string | null
          round?: number
          status?: string
          updated_date?: string
          user_id: string
        }
        Update: {
          amount?: number
          auction_id?: string
          created_date?: string
          id?: string
          reason?: string | null
          released_at?: string | null
          retry_until?: string | null
          round?: number
          status?: string
          updated_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_holds_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_holds_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          amount: number
          archived: boolean
          auction_id: string
          burned: boolean
          burned_at: string | null
          client_request_id: string | null
          created_by: string | null
          created_date: string
          id: string
          round: number
          updated_date: string
          user_id: string
        }
        Insert: {
          amount: number
          archived?: boolean
          auction_id: string
          burned?: boolean
          burned_at?: string | null
          client_request_id?: string | null
          created_by?: string | null
          created_date?: string
          id?: string
          round?: number
          updated_date?: string
          user_id: string
        }
        Update: {
          amount?: number
          archived?: boolean
          auction_id?: string
          burned?: boolean
          burned_at?: string | null
          client_request_id?: string | null
          created_by?: string | null
          created_date?: string
          id?: string
          round?: number
          updated_date?: string
          user_id?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          active: boolean
          created_by: string | null
          created_date: string
          id: string
          logo_url: string | null
          name: string
          slug: string | null
          sort_order: number
          updated_date: string
        }
        Insert: {
          active?: boolean
          created_by?: string | null
          created_date?: string
          id?: string
          logo_url?: string | null
          name: string
          slug?: string | null
          sort_order?: number
          updated_date?: string
        }
        Update: {
          active?: boolean
          created_by?: string | null
          created_date?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string | null
          sort_order?: number
          updated_date?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          color: string | null
          created_by: string | null
          created_date: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string | null
          sort_order: number
          updated_date: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_by?: string | null
          created_date?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug?: string | null
          sort_order?: number
          updated_date?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_by?: string | null
          created_date?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string | null
          sort_order?: number
          updated_date?: string
        }
        Relationships: []
      }
      contents: {
        Row: {
          created_by: string | null
          created_date: string
          id: string
          key: string
          label: string | null
          updated_date: string
          value_ar: string | null
          value_en: string | null
        }
        Insert: {
          created_by?: string | null
          created_date?: string
          id?: string
          key: string
          label?: string | null
          updated_date?: string
          value_ar?: string | null
          value_en?: string | null
        }
        Update: {
          created_by?: string | null
          created_date?: string
          id?: string
          key?: string
          label?: string | null
          updated_date?: string
          value_ar?: string | null
          value_en?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_by: string | null
          created_date: string
          description: string | null
          expires_at: string | null
          id: string
          max_uses: number
          min_amount: number
          type: string
          updated_date: string
          uses: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_by?: string | null
          created_date?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number
          min_amount?: number
          type?: string
          updated_date?: string
          uses?: number
          value?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_by?: string | null
          created_date?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number
          min_amount?: number
          type?: string
          updated_date?: string
          uses?: number
          value?: number
        }
        Relationships: []
      }
      cron_tokens: {
        Row: {
          created_date: string
          name: string
          token: string
          updated_date: string
        }
        Insert: {
          created_date?: string
          name: string
          token: string
          updated_date?: string
        }
        Update: {
          created_date?: string
          name?: string
          token?: string
          updated_date?: string
        }
        Relationships: []
      }
      fulfilments: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_line1: string | null
          address_line2: string | null
          address_name: string | null
          address_phone: string | null
          address_zip: string | null
          auction_id: string
          carrier: string | null
          created_by: string | null
          created_date: string
          id: string
          method: string
          notes: string | null
          pickup_notes: string | null
          status: string
          tracking_number: string | null
          updated_date: string
          winner_id: string
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_name?: string | null
          address_phone?: string | null
          address_zip?: string | null
          auction_id: string
          carrier?: string | null
          created_by?: string | null
          created_date?: string
          id?: string
          method?: string
          notes?: string | null
          pickup_notes?: string | null
          status?: string
          tracking_number?: string | null
          updated_date?: string
          winner_id: string
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_name?: string | null
          address_phone?: string | null
          address_zip?: string | null
          auction_id?: string
          carrier?: string | null
          created_by?: string | null
          created_date?: string
          id?: string
          method?: string
          notes?: string | null
          pickup_notes?: string | null
          status?: string
          tracking_number?: string | null
          updated_date?: string
          winner_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          auction_id: string | null
          body: string | null
          channel: string
          created_by: string | null
          created_date: string
          id: string
          read: boolean
          recipient: string | null
          status: string
          title: string
          type: string
          updated_date: string
          user_id: string | null
        }
        Insert: {
          auction_id?: string | null
          body?: string | null
          channel?: string
          created_by?: string | null
          created_date?: string
          id?: string
          read?: boolean
          recipient?: string | null
          status?: string
          title: string
          type?: string
          updated_date?: string
          user_id?: string | null
        }
        Update: {
          auction_id?: string | null
          body?: string | null
          channel?: string
          created_by?: string | null
          created_date?: string
          id?: string
          read?: boolean
          recipient?: string | null
          status?: string
          title?: string
          type?: string
          updated_date?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pages: {
        Row: {
          body_ar: string | null
          body_en: string | null
          created_by: string | null
          created_date: string
          id: string
          published: boolean
          slug: string
          title_ar: string | null
          title_en: string | null
          updated_date: string
        }
        Insert: {
          body_ar?: string | null
          body_en?: string | null
          created_by?: string | null
          created_date?: string
          id?: string
          published?: boolean
          slug: string
          title_ar?: string | null
          title_en?: string | null
          updated_date?: string
        }
        Update: {
          body_ar?: string | null
          body_en?: string | null
          created_by?: string | null
          created_date?: string
          id?: string
          published?: boolean
          slug?: string
          title_ar?: string | null
          title_en?: string | null
          updated_date?: string
        }
        Relationships: []
      }
      participant_notes: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          created_by: string | null
          created_date: string
          id: string
          updated_date: string
          user_id: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body: string
          created_by?: string | null
          created_date?: string
          id?: string
          updated_date?: string
          user_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          created_by?: string | null
          created_date?: string
          id?: string
          updated_date?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_method_credentials: {
        Row: {
          created_by: string | null
          created_date: string
          id: string
          payment_method_id: string
          publishable_key: string | null
          secret_key: string | null
          updated_date: string
          webhook_secret: string | null
        }
        Insert: {
          created_by?: string | null
          created_date?: string
          id?: string
          payment_method_id: string
          publishable_key?: string | null
          secret_key?: string | null
          updated_date?: string
          webhook_secret?: string | null
        }
        Update: {
          created_by?: string | null
          created_date?: string
          id?: string
          payment_method_id?: string
          publishable_key?: string | null
          secret_key?: string | null
          updated_date?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_by: string | null
          created_date: string
          display_order: number
          enabled: boolean
          id: string
          instructions: string | null
          logo: string | null
          name: string
          provider: string | null
          type: string
          updated_date: string
        }
        Insert: {
          created_by?: string | null
          created_date?: string
          display_order?: number
          enabled?: boolean
          id?: string
          instructions?: string | null
          logo?: string | null
          name: string
          provider?: string | null
          type?: string
          updated_date?: string
        }
        Update: {
          created_by?: string | null
          created_date?: string
          display_order?: number
          enabled?: boolean
          id?: string
          instructions?: string | null
          logo?: string | null
          name?: string
          provider?: string | null
          type?: string
          updated_date?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_line1: string | null
          address_line2: string | null
          address_state: string | null
          address_zip: string | null
          country: string | null
          country_code: string | null
          created_date: string
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          ip: string | null
          is_super: boolean
          last_name: string | null
          paused: boolean
          permissions: Json
          phone: string | null
          staff_role: string | null
          updated_date: string
          verification_note: string | null
          verification_status: string
          watched_auction_ids: string[]
          whatsapp_country_code: string | null
          whatsapp_number: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_state?: string | null
          address_zip?: string | null
          country?: string | null
          country_code?: string | null
          created_date?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          ip?: string | null
          is_super?: boolean
          last_name?: string | null
          paused?: boolean
          permissions?: Json
          phone?: string | null
          staff_role?: string | null
          updated_date?: string
          verification_note?: string | null
          verification_status?: string
          watched_auction_ids?: string[]
          whatsapp_country_code?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_state?: string | null
          address_zip?: string | null
          country?: string | null
          country_code?: string | null
          created_date?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          ip?: string | null
          is_super?: boolean
          last_name?: string | null
          paused?: boolean
          permissions?: Json
          phone?: string | null
          staff_role?: string | null
          updated_date?: string
          verification_note?: string | null
          verification_status?: string
          watched_auction_ids?: string[]
          whatsapp_country_code?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          admin_note: string | null
          created_by: string | null
          created_date: string
          id: string
          original_transaction_id: string | null
          reason: string | null
          refund_transaction_id: string | null
          status: string
          updated_date: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_by?: string | null
          created_date?: string
          id?: string
          original_transaction_id?: string | null
          reason?: string | null
          refund_transaction_id?: string | null
          status?: string
          updated_date?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_by?: string | null
          created_date?: string
          id?: string
          original_transaction_id?: string | null
          reason?: string | null
          refund_transaction_id?: string | null
          status?: string
          updated_date?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_by: string | null
          created_date: string
          id: string
          reason: string
          reporter_name: string | null
          resolution_note: string | null
          status: string
          target_id: string | null
          target_title: string | null
          target_type: string
          updated_date: string
        }
        Insert: {
          created_by?: string | null
          created_date?: string
          id?: string
          reason: string
          reporter_name?: string | null
          resolution_note?: string | null
          status?: string
          target_id?: string | null
          target_title?: string | null
          target_type?: string
          updated_date?: string
        }
        Update: {
          created_by?: string | null
          created_date?: string
          id?: string
          reason?: string
          reporter_name?: string | null
          resolution_note?: string | null
          status?: string
          target_id?: string | null
          target_title?: string | null
          target_type?: string
          updated_date?: string
        }
        Relationships: []
      }
      role_capabilities: {
        Row: {
          allowed: boolean
          capability_key: string
          created_date: string
          role_id: string
          updated_date: string
        }
        Insert: {
          allowed?: boolean
          capability_key: string
          created_date?: string
          role_id: string
          updated_date?: string
        }
        Update: {
          allowed?: boolean
          capability_key?: string
          created_date?: string
          role_id?: string
          updated_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_capabilities_capability_key_fkey"
            columns: ["capability_key"]
            isOneToOne: false
            referencedRelation: "admin_capabilities"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_capabilities_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_by: string | null
          created_date: string
          description: string | null
          id: string
          is_system: boolean
          level: number
          name: string
          permissions: Json
          slug: string | null
          updated_date: string
        }
        Insert: {
          created_by?: string | null
          created_date?: string
          description?: string | null
          id?: string
          is_system?: boolean
          level?: number
          name: string
          permissions?: Json
          slug?: string | null
          updated_date?: string
        }
        Update: {
          created_by?: string | null
          created_date?: string
          description?: string | null
          id?: string
          is_system?: boolean
          level?: number
          name?: string
          permissions?: Json
          slug?: string | null
          updated_date?: string
        }
        Relationships: []
      }
      shipping_methods: {
        Row: {
          active: boolean
          carrier: string | null
          created_by: string | null
          created_date: string
          estimated_days: number
          id: string
          name: string
          rate_flat: number
          rate_per_kg: number
          updated_date: string
          zone: string | null
        }
        Insert: {
          active?: boolean
          carrier?: string | null
          created_by?: string | null
          created_date?: string
          estimated_days?: number
          id?: string
          name: string
          rate_flat?: number
          rate_per_kg?: number
          updated_date?: string
          zone?: string | null
        }
        Update: {
          active?: boolean
          carrier?: string | null
          created_by?: string | null
          created_date?: string
          estimated_days?: number
          id?: string
          name?: string
          rate_flat?: number
          rate_per_kg?: number
          updated_date?: string
          zone?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          active_currency: string | null
          contact_email: string | null
          created_by: string | null
          created_date: string
          id: string
          key: string
          maintenance_message: string | null
          maintenance_mode: boolean
          site_name: string | null
          tagline: string | null
          timezone: string | null
          updated_date: string
        }
        Insert: {
          active_currency?: string | null
          contact_email?: string | null
          created_by?: string | null
          created_date?: string
          id?: string
          key?: string
          maintenance_message?: string | null
          maintenance_mode?: boolean
          site_name?: string | null
          tagline?: string | null
          timezone?: string | null
          updated_date?: string
        }
        Update: {
          active_currency?: string | null
          contact_email?: string | null
          created_by?: string | null
          created_date?: string
          id?: string
          key?: string
          maintenance_message?: string | null
          maintenance_mode?: boolean
          site_name?: string | null
          tagline?: string | null
          timezone?: string | null
          updated_date?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          auction_id: string | null
          body: string
          category: string
          created_by: string | null
          created_date: string
          id: string
          priority: string
          replied_at: string | null
          replied_by_id: string | null
          staff_reply: string | null
          status: string
          subject: string
          updated_date: string
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          auction_id?: string | null
          body: string
          category?: string
          created_by?: string | null
          created_date?: string
          id?: string
          priority?: string
          replied_at?: string | null
          replied_by_id?: string | null
          staff_reply?: string | null
          status?: string
          subject: string
          updated_date?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          auction_id?: string | null
          body?: string
          category?: string
          created_by?: string | null
          created_date?: string
          id?: string
          priority?: string
          replied_at?: string | null
          replied_by_id?: string | null
          staff_reply?: string | null
          status?: string
          subject?: string
          updated_date?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      templates: {
        Row: {
          active: boolean
          body: string | null
          channel: string
          created_by: string | null
          created_date: string
          id: string
          key: string
          subject: string | null
          updated_date: string
          variables: string | null
        }
        Insert: {
          active?: boolean
          body?: string | null
          channel?: string
          created_by?: string | null
          created_date?: string
          id?: string
          key: string
          subject?: string | null
          updated_date?: string
          variables?: string | null
        }
        Update: {
          active?: boolean
          body?: string | null
          channel?: string
          created_by?: string | null
          created_date?: string
          id?: string
          key?: string
          subject?: string | null
          updated_date?: string
          variables?: string | null
        }
        Relationships: []
      }
      themes: {
        Row: {
          created_by: string | null
          created_date: string
          id: string
          scope: string
          theme: Json
          updated_date: string
        }
        Insert: {
          created_by?: string | null
          created_date?: string
          id?: string
          scope?: string
          theme?: Json
          updated_date?: string
        }
        Update: {
          created_by?: string | null
          created_date?: string
          id?: string
          scope?: string
          theme?: Json
          updated_date?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_date: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_date?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_date?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          auction_id: string | null
          created_by: string | null
          created_date: string
          description: string | null
          id: string
          notes: string | null
          payment_method_id: string | null
          provider: string | null
          provider_txn_id: string | null
          reference: string | null
          status: string
          type: string
          updated_date: string
          user_id: string
        }
        Insert: {
          amount: number
          auction_id?: string | null
          created_by?: string | null
          created_date?: string
          description?: string | null
          id?: string
          notes?: string | null
          payment_method_id?: string | null
          provider?: string | null
          provider_txn_id?: string | null
          reference?: string | null
          status?: string
          type?: string
          updated_date?: string
          user_id: string
        }
        Update: {
          amount?: number
          auction_id?: string | null
          created_by?: string | null
          created_date?: string
          description?: string | null
          id?: string
          notes?: string | null
          payment_method_id?: string | null
          provider?: string | null
          provider_txn_id?: string | null
          reference?: string | null
          status?: string
          type?: string
          updated_date?: string
          user_id?: string
        }
        Relationships: []
      }
      winner_payments: {
        Row: {
          amount: number
          auction_id: string
          created_date: string
          id: string
          note: string | null
          paid_at: string | null
          paid_reference: string | null
          round: number
          status: string
          token: string
          updated_date: string
          user_id: string
        }
        Insert: {
          amount?: number
          auction_id: string
          created_date?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          paid_reference?: string | null
          round?: number
          status?: string
          token?: string
          updated_date?: string
          user_id: string
        }
        Update: {
          amount?: number
          auction_id?: string
          created_date?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          paid_reference?: string | null
          round?: number
          status?: string
          token?: string
          updated_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "winner_payments_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "winner_payments_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      auctions_public: {
        Row: {
          anti_snipe_seconds: number | null
          bid_fee: number | null
          bid_increment: number | null
          bid_rate_limit: number | null
          bid_rate_window_minutes: number | null
          bids_per_participant: number | null
          brand_id: string | null
          category_id: string | null
          created_date: string | null
          current_price: number | null
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          entry_fee: number | null
          extra_bid_price: number | null
          featured: boolean | null
          featured_order: number | null
          focal_x: number | null
          focal_y: number | null
          id: string | null
          image_height: number | null
          image_url: string | null
          image_width: number | null
          max_restarts: number | null
          max_subscribers: number | null
          min_participants: number | null
          min_round_minutes: number | null
          mode: string | null
          paid: boolean | null
          pool_warn_pct: number | null
          restart_count: number | null
          round: number | null
          scheduled_start_time: string | null
          start_price: number | null
          start_time: string | null
          status: string | null
          subscriber_count: number | null
          target_price: number | null
          title: string | null
          updated_date: string | null
          winner_name: string | null
        }
        Insert: {
          anti_snipe_seconds?: number | null
          bid_fee?: number | null
          bid_increment?: number | null
          bid_rate_limit?: number | null
          bid_rate_window_minutes?: number | null
          bids_per_participant?: number | null
          brand_id?: string | null
          category_id?: string | null
          created_date?: string | null
          current_price?: number | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          entry_fee?: number | null
          extra_bid_price?: number | null
          featured?: boolean | null
          featured_order?: number | null
          focal_x?: number | null
          focal_y?: number | null
          id?: string | null
          image_height?: number | null
          image_url?: string | null
          image_width?: number | null
          max_restarts?: number | null
          max_subscribers?: number | null
          min_participants?: number | null
          min_round_minutes?: number | null
          mode?: string | null
          paid?: boolean | null
          pool_warn_pct?: number | null
          restart_count?: number | null
          round?: number | null
          scheduled_start_time?: string | null
          start_price?: number | null
          start_time?: string | null
          status?: string | null
          subscriber_count?: number | null
          target_price?: number | null
          title?: string | null
          updated_date?: string | null
          winner_name?: string | null
        }
        Update: {
          anti_snipe_seconds?: number | null
          bid_fee?: number | null
          bid_increment?: number | null
          bid_rate_limit?: number | null
          bid_rate_window_minutes?: number | null
          bids_per_participant?: number | null
          brand_id?: string | null
          category_id?: string | null
          created_date?: string | null
          current_price?: number | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          entry_fee?: number | null
          extra_bid_price?: number | null
          featured?: boolean | null
          featured_order?: number | null
          focal_x?: number | null
          focal_y?: number | null
          id?: string | null
          image_height?: number | null
          image_url?: string | null
          image_width?: number | null
          max_restarts?: number | null
          max_subscribers?: number | null
          min_participants?: number | null
          min_round_minutes?: number | null
          mode?: string | null
          paid?: boolean | null
          pool_warn_pct?: number | null
          restart_count?: number | null
          round?: number | null
          scheduled_start_time?: string | null
          start_price?: number | null
          start_time?: string | null
          status?: string | null
          subscriber_count?: number | null
          target_price?: number | null
          title?: string | null
          updated_date?: string | null
          winner_name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_dashboard: { Args: { _from: string; _to: string }; Returns: Json }
      admin_dashboard_guard: { Args: never; Returns: undefined }
      auction_round_counts: {
        Args: { _auction_id: string; _round: number }
        Returns: {
          bid_count: number
          cancelled_count: number
          taken_count: number
        }[]
      }
      available_balance: { Args: { _user_id: string }; Returns: number }
      bid_rate_status: {
        Args: { _auction_id: string; _user_id: string }
        Returns: Json
      }
      bid_window_start: {
        Args: { _at?: string; _window_minutes: number }
        Returns: string
      }
      buy_bid_credits: {
        Args: { _auction_id: string; _count: number; _user_id: string }
        Returns: Json
      }
      can_manage_media: { Args: { _uid: string }; Returns: boolean }
      has_admin_capability: {
        Args: { _key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      held_amount: { Args: { _user_id: string }; Returns: number }
      join_auction_atomic: {
        Args: { _auction_id: string; _user_id: string }
        Returns: Json
      }
      my_admin_capabilities: { Args: never; Returns: string[] }
      my_admin_capabilities_for: {
        Args: { _user_id: string }
        Returns: string[]
      }
      place_ascending_bid: {
        Args: {
          _amount: number
          _auction_id: string
          _client_request_id?: string
          _user_id: string
        }
        Returns: Json
      }
      place_closest_bid: {
        Args: {
          _amount: number
          _auction_id: string
          _client_request_id?: string
          _user_id: string
        }
        Returns: Json
      }
      release_auction_holds: {
        Args: {
          _auction_id: string
          _retry_minutes?: number
          _round?: number
          _winner_id?: string
        }
        Returns: Json
      }
      release_expired_holds: { Args: never; Returns: Json }
      void_auction_refund: {
        Args: { _auction_id: string; _reason?: string }
        Returns: Json
      }
      wallet_confirmed_balance: { Args: { _user_id: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
