import { Card } from "@/components/ui/card";

// ──────────────────────────────────────────────
// Placeholder data — swap with real API data later.
// Each routine has a name, description, and a list
// of skills with target durations.
// ──────────────────────────────────────────────
type Skill = { name: string; duration: string };
type Routine = {
  id: string;
  label: string;
  name: string;
  skills: Skill[];
  totalDuration: string;
};

const PLACEHOLDER_ROUTINES: Routine[] = [
  {
    id: "1",
    label: "MORNING ROUTINE",
    name: "Daily Practice",
    skills: [
      { name: "Guitar", duration: "30 min" },
      { name: "Coding", duration: "45 min" },
      { name: "Reading", duration: "15 min" },
    ],
    totalDuration: "1h 30m",
  },
  {
    id: "2",
    label: "EVENING ROUTINE",
    name: "Wind Down",
    skills: [
      { name: "Meditation", duration: "15 min" },
      { name: "Drawing", duration: "30 min" },
    ],
    totalDuration: "45m",
  },
  {
    id: "3",
    label: "WEEKEND DEEP DIVE",
    name: "Skill Sprint",
    skills: [
      { name: "Piano", duration: "60 min" },
      { name: "Spanish", duration: "45 min" },
      { name: "Cooking", duration: "30 min" },
      { name: "Chess", duration: "20 min" },
    ],
    totalDuration: "2h 35m",
  },
  {
    id: "4",
    label: "QUICK SESSION",
    name: "15-Min Focus",
    skills: [{ name: "Typing", duration: "15 min" }],
    totalDuration: "15m",
  },
];

const ROW_COLORS = [
  "bg-primary/20",
  "bg-primary/30",
  "bg-primary/10",
  "bg-primary/15",
  "bg-primary/25",
];

export function RoutineCard({ routine }: { routine: Routine }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-mono text-muted-foreground mb-1">
        {routine.label}
      </p>
      <p className="text-sm font-semibold text-foreground mb-4">
        {routine.name}
      </p>
      <div className="space-y-3">
        {routine.skills.map((skill, i) => (
          <div
            key={skill.name}
            className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${ROW_COLORS[i % ROW_COLORS.length]}`}
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/40 flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                {i + 1}
              </span>
              <span className="text-sm font-medium text-foreground">
                {skill.name}
              </span>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {skill.duration}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Total</span>
        <span className="text-sm font-mono font-semibold text-foreground">
          {routine.totalDuration}
        </span>
      </div>
    </Card>
  );
}

export function RoutinesView() {
  // TODO: Replace with real data from API
  const routines = PLACEHOLDER_ROUTINES;

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Your Routines</h2>
      </div>
      {routines.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No routines yet. Create your first practice routine.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {routines.map((routine) => (
            <RoutineCard key={routine.id} routine={routine} />
          ))}
        </div>
      )}
    </div>
  );
}
