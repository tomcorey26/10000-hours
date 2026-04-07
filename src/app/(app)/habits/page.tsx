import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { Dashboard } from "@/components/Dashboard";
import { Suspense } from "react";
import { Spinner } from "@/components/Spinner";
import { getHabitsForUser } from "@/server/db/habits";

export default async function HabitsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const habits = await getHabitsForUser(userId);

  return (
    <Suspense fallback={<Spinner />}>
      <Dashboard initialHabits={habits} />
    </Suspense>
  );
}
