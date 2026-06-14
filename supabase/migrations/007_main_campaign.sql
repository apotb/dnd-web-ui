-- Add is_main flag to campaigns table.
-- At most one campaign should have is_main = true at any time;
-- this is enforced at the application layer.
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS is_main BOOLEAN NOT NULL DEFAULT false;

-- Allow any DM (DM in any campaign) to flip is_main on any campaign.
-- This is a global setting so campaign-scoped DM check is too narrow.
CREATE POLICY "Any DM can set main campaign"
  ON public.campaigns FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_members
      WHERE user_id = auth.uid() AND role = 'dm'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_members
      WHERE user_id = auth.uid() AND role = 'dm'
    )
  );
