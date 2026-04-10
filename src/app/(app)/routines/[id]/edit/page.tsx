import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { getSessionUserId } from "@/lib/auth";
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
  const routine = await getRoutineById(Number(id), userId);
  if (!routine) notFound();

  return (
    <Suspense fallback={<Spinner />}>
      <RoutineBuilderPage mode="edit" routine={routine} />
    </Suspense>
  );
}
