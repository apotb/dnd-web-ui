-- Any player with a claimed character (or DM) can edit/delete all calendar events.

DROP POLICY IF EXISTS "Owner or DM can update calendar events"
  ON public.campaign_calendar_events;

DROP POLICY IF EXISTS "Owner or DM can delete calendar events"
  ON public.campaign_calendar_events;

CREATE POLICY "Participants can update calendar events"
  ON public.campaign_calendar_events FOR UPDATE
  TO authenticated
  USING (
    public.is_campaign_dm(campaign_id)
    OR public.user_owns_character_in_campaign(campaign_id)
  )
  WITH CHECK (
    public.is_campaign_dm(campaign_id)
    OR public.user_owns_character_in_campaign(campaign_id)
  );

CREATE POLICY "Participants can delete calendar events"
  ON public.campaign_calendar_events FOR DELETE
  TO authenticated
  USING (
    public.is_campaign_dm(campaign_id)
    OR public.user_owns_character_in_campaign(campaign_id)
  );
