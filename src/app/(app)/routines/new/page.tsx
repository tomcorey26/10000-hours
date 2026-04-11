import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUserId } from "@/lib/auth";
import { getHabitsForUser } from "@/server/db/habits";
import { Spinner } from "@/components/Spinner";
import { RoutineBuilderPage } from "@/components/RoutineBuilderPage";

export default async function NewRoutinePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const habits = await getHabitsForUser(userId);

  return (
    <Suspense fallback={<Spinner />}>
      <RoutineBuilderPage mode="create" initialHabits={habits} />
    </Suspense>
  );
}
