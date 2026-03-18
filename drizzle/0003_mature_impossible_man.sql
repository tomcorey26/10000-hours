PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_time_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`habit_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`duration_seconds` integer NOT NULL,
	`timer_mode` text NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_time_sessions`("id", "habit_id", "user_id", "start_time", "end_time", "duration_seconds", "timer_mode") SELECT "id", "habit_id", "user_id", "start_time", "end_time", "duration_seconds", "timer_mode" FROM `time_sessions`;--> statement-breakpoint
DROP TABLE `time_sessions`;--> statement-breakpoint
ALTER TABLE `__new_time_sessions` RENAME TO `time_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;