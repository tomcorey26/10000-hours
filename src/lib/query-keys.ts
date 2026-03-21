export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  habits: {
    all: ['habits'] as const,
  },
  sessions: {
    all: ['sessions'] as const,
    list: (filters: { habitId?: string; range?: string; viewMode: string }) =>
      ['sessions', 'list', filters] as const,
    byDate: (date: string) => ['sessions', 'byDate', date] as const,
  },
  rankings: {
    all: ['rankings'] as const,
  },
};
