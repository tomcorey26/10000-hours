import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const passkeyCredentials = sqliteTable('passkey_credentials', {
  id: text('id').primaryKey(), // base64url credential ID
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  publicKey: text('public_key').notNull(), // base64url encoded
  counter: integer('counter').notNull().default(0),
  deviceType: text('device_type').notNull(), // "singleDevice" | "multiDevice"
  backedUp: integer('backed_up', { mode: 'boolean' }).notNull().default(false),
  transports: text('transports'), // JSON array string
  label: text('label'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const challenges = sqliteTable('challenges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  userId: integer('user_id'),
  challenge: text('challenge').notNull(),
  type: text('type').notNull(), // "registration" | "authentication"
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

export const habits = sqliteTable('habits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const timeSessions = sqliteTable('time_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  habitId: integer('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp' }).notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  timerMode: text('timer_mode').notNull().$default(() => 'stopwatch'),
});

export const activeTimers = sqliteTable('active_timers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  habitId: integer('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  targetDurationSeconds: integer('target_duration_seconds'),
});

export const usersRelations = relations(users, ({ many }) => ({
  habits: many(habits),
  activeTimers: many(activeTimers),
  passkeyCredentials: many(passkeyCredentials),
}));

export const passkeyCredentialsRelations = relations(passkeyCredentials, ({ one }) => ({
  user: one(users, { fields: [passkeyCredentials.userId], references: [users.id] }),
}));

export const habitsRelations = relations(habits, ({ one, many }) => ({
  user: one(users, { fields: [habits.userId], references: [users.id] }),
  timeSessions: many(timeSessions),
  activeTimers: many(activeTimers),
}));

export const timeSessionsRelations = relations(timeSessions, ({ one }) => ({
  habit: one(habits, { fields: [timeSessions.habitId], references: [habits.id] }),
  user: one(users, { fields: [timeSessions.userId], references: [users.id] }),
}));

export const activeTimersRelations = relations(activeTimers, ({ one }) => ({
  habit: one(habits, { fields: [activeTimers.habitId], references: [habits.id] }),
  user: one(users, { fields: [activeTimers.userId], references: [users.id] }),
}));
