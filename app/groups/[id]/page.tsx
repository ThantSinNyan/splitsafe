import { GroupWorkspace } from "@/components/group-workspace";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <GroupWorkspace groupId={id} />;
}
