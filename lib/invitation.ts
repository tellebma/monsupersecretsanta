import { configured, workerClient } from "./supabase";

export type InvitationPreview = {
  group: string;
  organizer: string | null;
  shared?: boolean;
  open?: boolean;
  participants?: { id: string; name: string; available: boolean }[];
};

export async function invitationPreview(path: string): Promise<InvitationPreview | null> {
  const token = /^\/invitation\/([a-f0-9]{64})(?:\?participant=[a-f0-9-]{36})?$/.exec(path)?.[1];
  if (!token || !configured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data, error } = await workerClient().rpc("santa_invitation_preview", { p_token: token });
  if (error || typeof data?.group !== "string") return null;
  return { group: data.group, organizer: typeof data.organizer === "string" ? data.organizer : null,
    shared: data.shared === true, open: data.open === true,
    participants: Array.isArray(data.participants) ? data.participants : [] };
}
