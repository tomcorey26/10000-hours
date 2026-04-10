import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { getSessionUserId } from "@/lib/auth";
import { getRoutineById } from "@/server/db/routines";
import { RoutineDetailView } from "@/components/RoutineDetailView";
import { Spinner } from "@/components/Spinner";

export default async function RoutineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { id } = await params;
  const routine = await getRoutineById(Number(id), userId);
  if (!routine) notFound();

  return (
    <Suspense fallback={<Spinner />}>
      <RoutineDetailView routineId={routine.id} initialRoutine={routine} />
    </Suspense>
  );
}
