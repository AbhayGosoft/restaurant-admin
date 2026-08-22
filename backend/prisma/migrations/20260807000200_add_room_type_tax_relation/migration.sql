-- AlterTable
ALTER TABLE `room_types` ADD COLUMN `tax_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `room_types_tax_id_idx` ON `room_types`(`tax_id`);

-- AddForeignKey
ALTER TABLE `room_types` ADD CONSTRAINT `room_types_tax_id_fkey` FOREIGN KEY (`tax_id`) REFERENCES `property_taxes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
