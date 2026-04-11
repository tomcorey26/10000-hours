import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { getSessionUserId } from "@/lib/auth";
import { getHabitsForUser } from "@/server/db/habits";
import { getRoutineById } from "@/server/db/routines";
import { Spinner } from "@/components/Spinner";
import { RoutineBuilderPage } from "@/components/RoutineBuilderPage";

export default async function EditRoutinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { id } = await params;
  const [routine, habits] = await Promise.all([
    getRoutineById(Number(id), userId),
    getHabitsForUser(userId),
  ]);
  if (!routine) notFound();

  return (
    <Suspense fallback={<Spinner />}>
      <RoutineBuilderPage mode="edit" routine={routine} initialHabits={habits} />
    </Suspense>
  );
}
