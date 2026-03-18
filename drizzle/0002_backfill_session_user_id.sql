UPDATE time_sessions
SET user_id = (SELECT user_id FROM habits WHERE habits.id = time_sessions.habit_id)
WHERE user_id IS NULL;
