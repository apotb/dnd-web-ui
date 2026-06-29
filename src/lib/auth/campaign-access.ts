import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Campaign, CampaignRole, Character } from "@/lib/types/database";
import type { User } from "@supabase/supabase-js";

export interface CampaignAccess {
  campaign: Campaign;
  isDm: boolean;
  role: CampaignRole | null;
  user: User | null;
  ownedCharacter: { id: string; name: string } | null;
  /** DM or player who has claimed a character in this campaign. */
  canUseNotebook: boolean;
}

export interface CharacterAccess extends CampaignAccess {
  character: Character;
  isOwner: boolean;
  canClaim: boolean;
  canEdit: boolean;
  ownedCharacter: { id: string; name: string } | null;
}

async function getUserOwnedCharacterInCampaign(
  campaignId: string,
  userId: string
): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("characters")
    .select("id, name")
    .eq("campaign_id", campaignId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  return data ?? null;
}

export async function getAuthUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export async function getCampaignAccess(
  campaignId: string
): Promise<CampaignAccess | null> {
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (!campaign) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      campaign,
      isDm: false,
      role: null,
      user: null,
      ownedCharacter: null,
      canUseNotebook: false,
    };
  }

  const { data: membership } = await supabase
    .from("campaign_members")
    .select("role")
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .maybeSingle();

  const role = (membership?.role as CampaignRole) ?? null;
  const ownedCharacter = await getUserOwnedCharacterInCampaign(
    campaignId,
    user.id
  );

  return {
    campaign,
    isDm: role === "dm",
    role,
    user,
    ownedCharacter,
    canUseNotebook: role !== null || ownedCharacter !== null,
  };
}

export async function getCharacterAccess(
  campaignId: string,
  characterId: string
): Promise<CharacterAccess | null> {
  const access = await getCampaignAccess(campaignId);
  if (!access) return null;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("characters")
    .select("*")
    .eq("id", characterId)
    .eq("campaign_id", campaignId)
    .single();

  if (!row) return null;

  const character = row as Character;
  const ownedCharacter = access.user
    ? await getUserOwnedCharacterInCampaign(campaignId, access.user.id)
    : null;
  const isOwner = !!access.user && character.owner_user_id === access.user.id;
  const canClaim =
    !!access.user &&
    character.owner_user_id === null &&
    (access.isDm || ownedCharacter === null);
  const canEdit = access.isDm || isOwner;

  return {
    ...access,
    character,
    isOwner,
    canClaim,
    canEdit,
    ownedCharacter,
  };
}

export async function requireCampaignAccess(
  campaignId: string
): Promise<CampaignAccess> {
  const access = await getCampaignAccess(campaignId);
  if (!access) notFound();
  return access;
}

export async function requireDm(campaignId: string): Promise<CampaignAccess> {
  const access = await requireCampaignAccess(campaignId);
  if (!access.isDm) redirect(`/campaigns/${campaignId}`);
  return access;
}
