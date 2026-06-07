# D&D Campaign Manager

MVP web UI for D&D campaigns focused on **character sheets** and **combat tracking**.

Built with Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, and Supabase (auth, database, realtime). Deploy-ready on Vercel.

## Features

- **Character management** — DM creates/edits/deletes characters; players view read-only sheets
- **Flexible JSON storage** — homebrew-friendly character data with Zod validation
- **JSON import/export** — paste or download character data
- **Combat tracker** — initiative order, turn/round tracking, HP/conditions/concentration
- **Player combat view** — live read-only view with vague enemy health labels
- **Realtime updates** — Supabase subscriptions for characters and combat
- **Row Level Security** — DM vs player permissions enforced in Postgres

## Quick start

### 1. Clone and install

```bash
npm install
cp .env.local.example .env.local
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key into `.env.local`
3. Run the migration in the SQL Editor:

```
supabase/migrations/001_initial_schema.sql
```

4. Enable Email auth under Authentication → Providers

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, and create a campaign.

### 4. Add players

When a player signs up, add them to your campaign via SQL (Dashboard → SQL Editor):

```sql
INSERT INTO campaign_members (campaign_id, user_id, role)
VALUES (
  'your-campaign-uuid',
  'player-user-uuid',
  'player'
);
```

Find user IDs under Authentication → Users.

## Deploy to Vercel

1. Push to GitHub
2. Import the repo in Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

## Data model

### Tables

| Table | Purpose |
|-------|---------|
| `campaigns` | Campaign metadata |
| `campaign_members` | User ↔ campaign with `dm` or `player` role |
| `characters` | Character name fields + flexible `data` JSONB |
| `encounters` | Combat encounter state (round, turn, active) |
| `encounter_combatants` | Combatants with `data` JSONB + initiative |

### Character JSON (`characters.data`)

Stored as JSONB and validated with Zod (`src/lib/schemas/character.ts`):

- `basicInfo` — name, playerName, level, classes, species, background, alignment, portrait, publicNotes, **dmNotes**
- `abilityScores` — STR/DEX/CON/INT/WIS/CHA
- `savingThrows`, `skills` — proficiencies and expertise
- `combat` — AC, HP, initiative, speed, death saves, conditions, concentration
- `attacks`, `spells`, `inventory`, `features`

Calculated values (not stored): ability modifiers, skill totals, passive Perception, spell DC/attack.

### Combatant JSON (`encounter_combatants.data`)

- name, type (`player` | `npc` | `monster`)
- AC, HP, temp HP, conditions, concentration
- **dmNotes** (stripped for players in the UI)

### Security

- RLS: only campaign members can read campaign data
- DM role required for insert/update/delete
- Players cannot see hidden combatants (`visible_to_players = false`)
- DM notes stripped server-side before rendering player views

## Project structure

```
src/
  app/                    # Next.js App Router pages
  components/
    character/            # Character sheet, editor, import/export
    combat/               # DM and player combat trackers
    layout/               # Campaign navigation
    ui/                   # shadcn/ui primitives
  lib/
    schemas/              # Zod schemas (character, combat)
    types/                # TypeScript database types
    dnd/                  # D&D calculations (modifiers, skills, HP)
    supabase/             # Client, server, middleware
    hooks/                # Realtime subscriptions
    auth/                 # Campaign access helpers
supabase/
  migrations/             # SQL schema + RLS
```

## Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/login` | Public | Sign in / sign up |
| `/campaigns` | Auth | Campaign list + create |
| `/campaigns/[id]` | Member | Dashboard |
| `/campaigns/[id]/characters` | Member | Character list |
| `/campaigns/[id]/characters/new` | DM | Create character |
| `/campaigns/[id]/characters/[id]` | Member | Sheet (edit for DM) |
| `/campaigns/[id]/combat` | Member | Encounter list |
| `/campaigns/[id]/combat/[id]` | Member | Combat tracker |

## Extending later

The modular layout is designed to add:

- Quests, lore, maps, NPC database, session notes
- Player-facing character form with JSON export for DM import
- Postgres views/RPC to strip `dmNotes` at the database layer
- Invite links for campaign members

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```
