import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { getHabitsForUser, autoStopExpiredCountdown } from "@/lib/queries";
import { parseAutoStoppedSearchParams } from "@/lib/auto-stop-search-params";
import { Dashboard } from "@/components/Dashboard";
import { AutoStopToastTrigger } from "@/components/AutoStopToast";
import { Suspense } from "react";
import { Spinner } from "@/components/Spinner";

type Props = {
  searchParams: Promise<{ autoStopped?: string; duration?: string }>;
};

export default async function SkillsPage({ searchParams }: Props) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const params = await searchParams;
  const habits = await getHabitsForUser(userId);

  // If redirected from /timer after auto-stop, validate params against user's actual habits
  // to prevent crafted URLs from showing misleading toast messages.
  // Otherwise check DB for expired timers (user navigated to /skills directly).
  let autoStopped: { habitName: string; durationSeconds: number } | null = null;
  if (params.autoStopped && params.duration) {
    autoStopped = parseAutoStoppedSearchParams(params, habits);
  } else {
    autoStopped = await autoStopExpiredCountdown(userId);
  }

  return (
    <Suspense fallback={<Spinner />}>
      <Dashboard initialHabits={habits} />
      {autoStopped && <AutoStopToastTrigger autoStopped={autoStopped} />}
    </Suspense>
  );
}
