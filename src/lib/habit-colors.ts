// Warm palette that complements the earthy theme.
// Uses CSS custom property values from globals.css chart colors.
export const HABIT_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export function getHabitColor(index: number): string {
  return HABIT_COLORS[index % HABIT_COLORS.length];
}
