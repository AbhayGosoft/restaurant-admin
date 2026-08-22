-- AlterTable
ALTER TABLE `stay_profiles` ADD COLUMN `address_line_2` VARCHAR(191) NULL,
    ADD COLUMN `cancellation_fee_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `facilities` JSON NULL,
    ADD COLUMN `near_by_places` JSON NULL,
    ADD COLUMN `star_rating` INTEGER NULL,
    ADD COLUMN `tax_percent` DECIMAL(5, 2) NULL,
    ADD COLUMN `taxes_included` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `website` VARCHAR(191) NULL;
