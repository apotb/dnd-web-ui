-- Party-wide inventory (animals, shared supplies) stored on the campaign.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS party_data JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
