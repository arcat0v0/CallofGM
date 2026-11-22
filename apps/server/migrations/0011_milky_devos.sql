ALTER TABLE `character_creation_rolls` ADD `locked_at` integer;--> statement-breakpoint
UPDATE `character_creation_rolls`
SET `locked_at` = COALESCE(`chosen_at`, `created_at`)
WHERE `chosen_index` IS NOT NULL
	AND `locked_at` IS NULL
	AND EXISTS (
		SELECT 1
		FROM `character_reviews`
		WHERE `character_reviews`.`invite_id` = `character_creation_rolls`.`invite_id`
			AND `character_reviews`.`submitted_by_user_id` = `character_creation_rolls`.`user_id`
	);