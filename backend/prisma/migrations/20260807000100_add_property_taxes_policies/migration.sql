-- CreateTable
CREATE TABLE `property_taxes` (
  `id` VARCHAR(191) NOT NULL,
  `property_id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `type` ENUM('GST', 'SERVICE_TAX', 'OTHER') NOT NULL DEFAULT 'GST',
  `percentage` DECIMAL(5, 2) NOT NULL,
  `description` TEXT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `deleted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `property_taxes_property_id_name_key`(`property_id`, `name`),
  INDEX `property_taxes_property_id_is_active_idx`(`property_id`, `is_active`),
  INDEX `property_taxes_deleted_at_idx`(`deleted_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_policies` (
  `id` VARCHAR(191) NOT NULL,
  `property_id` VARCHAR(191) NOT NULL,
  `type` ENUM('CANCELLATION', 'HOUSE_RULE') NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `content` TEXT NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `deleted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `property_policies_property_id_type_title_key`(`property_id`, `type`, `title`),
  INDEX `property_policies_property_id_type_is_active_idx`(`property_id`, `type`, `is_active`),
  INDEX `property_policies_deleted_at_idx`(`deleted_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `property_taxes` ADD CONSTRAINT `property_taxes_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `stay_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_policies` ADD CONSTRAINT `property_policies_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `stay_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
