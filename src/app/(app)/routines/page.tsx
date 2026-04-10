import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { RoutinesView } from "@/components/RoutinesView";

export default async function RoutinesPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  return <RoutinesView />;
}
