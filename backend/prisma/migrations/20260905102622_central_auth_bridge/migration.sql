-- DropIndex
DROP INDEX `restaurant_users_firebase_uid_key` ON `restaurant_users`;

-- AlterTable
ALTER TABLE `restaurant_users`
    DROP COLUMN `firebase_uid`,
    ADD COLUMN `central_user_id` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `restaurant_users_central_user_id_key` ON `restaurant_users`(`central_user_id`);
