-- AlterTable
ALTER TABLE `services` ADD COLUMN `available_days` JSON NULL,
    ADD COLUMN `is_mandatory` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `price_type` ENUM('PER_STAY', 'PER_GUEST', 'PER_ROOM') NOT NULL DEFAULT 'PER_STAY',
    ADD COLUMN `quantity_allowed` INTEGER NULL,
    ADD COLUMN `valid_from` DATE NULL,
    ADD COLUMN `valid_to` DATE NULL;
