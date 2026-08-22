-- AlterTable
ALTER TABLE `rate_plans` ADD COLUMN `advance_payment_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `cancellation_policy` TEXT NULL,
    ADD COLUMN `free_cancellation` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `is_refundable` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `meal_plan` ENUM('ROOM_ONLY', 'BREAKFAST', 'HALF_BOARD', 'FULL_BOARD', 'ALL_INCLUSIVE') NOT NULL DEFAULT 'ROOM_ONLY',
    ADD COLUMN `pay_at_hotel` BOOLEAN NOT NULL DEFAULT false;
