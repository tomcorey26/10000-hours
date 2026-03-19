import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { TimerView } from "@/components/TimerView";
import { getHabitsForUser } from "@/server/db/habits";
import { autoStopExpiredCountdown } from "@/server/db/timers";

export default async function TimerPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const autoStopped = await autoStopExpiredCountdown(userId);

  const habits = await getHabitsForUser(userId);
  const activeHabit = habits.find((h) => h.activeTimer);

  // No active timer — redirect back to habits
  if (!activeHabit) {
    if (autoStopped) {
      redirect(
        `/habits?autoStopped=${encodeURIComponent(autoStopped.habitName)}&duration=${autoStopped.durationSeconds}`,
      );
    }
    redirect("/habits");
  }

  return (
    <TimerView
      habitName={activeHabit.name}
      startTime={activeHabit.activeTimer!.startTime}
      targetDurationSeconds={activeHabit.activeTimer!.targetDurationSeconds}
      todaySeconds={activeHabit.todaySeconds}
      streak={activeHabit.streak}
    />
  );
}
