import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { SessionsView } from "@/components/SessionsView";
import { Suspense } from "react";
import { Spinner } from "@/components/Spinner";
import { getHabitsForUser } from "@/server/db/habits";

export default async function SessionsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const habits = await getHabitsForUser(userId);
  const habitsList = habits.map((h) => ({ id: h.id, name: h.name }));

  return (
    <Suspense fallback={<Spinner />}>
      <SessionsView habits={habitsList} />
    </Suspense>
  );
}
