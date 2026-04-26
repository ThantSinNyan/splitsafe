import { InviteAcceptance } from "@/components/group-workspace";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <InviteAcceptance token={token} />;
}
