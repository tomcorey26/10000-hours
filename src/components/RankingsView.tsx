'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatTime } from '@/lib/format';
import { useRankings } from '@/hooks/use-rankings';

const RANK_COLORS: Record<number, string> = {
  1: 'text-yellow-500',
  2: 'text-gray-400',
  3: 'text-amber-600',
};

type Ranking = {
  rank: number;
  habitId: number;
  habitName: string;
  totalSeconds: number;
};

export function RankingsView({ initialRankings }: { initialRankings?: Ranking[] }) {
  const { data: rankings } = useRankings(initialRankings);

  if (rankings.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No rankings yet</p>;
  }

  return (
    <div className="space-y-2 md:max-w-2xl md:mx-auto">
      <div className="text-center py-4">
        <h2 className="text-2xl font-bold">Rankings</h2>
        <p className="text-sm text-muted-foreground">Your skills ranked by total time</p>
      </div>
      {rankings.map((r) => (
        <Card key={r.habitId}>
          <CardContent className="p-3 flex items-center gap-3">
            <span className={`text-lg font-bold w-8 ${RANK_COLORS[r.rank] || 'text-muted-foreground'}`}>
              #{r.rank}
            </span>
            <span className="font-medium flex-1 truncate min-w-0">{r.habitName}</span>
            <span className="font-mono text-sm text-muted-foreground">{formatTime(r.totalSeconds)}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
