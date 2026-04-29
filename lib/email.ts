export type SendInviteEmailInput = {
  email: string;
  inviteLink: string;
  groupName: string;
  role: string;
};

export type SendInviteEmailResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function sendInviteEmail(
  _input: SendInviteEmailInput,
): Promise<SendInviteEmailResult> {
  void _input;
  return { ok: false, reason: "Email provider not configured" };
}
