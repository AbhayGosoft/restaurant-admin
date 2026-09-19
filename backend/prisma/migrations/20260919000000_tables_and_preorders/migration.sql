CREATE TABLE `dining_tables` (
  `id` VARCHAR(191) NOT NULL,
  `restaurant_id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `capacity` INTEGER NOT NULL,
  `preference` ENUM('ANY', 'WINDOW', 'INDOOR', 'OUTDOOR') NOT NULL DEFAULT 'ANY',
  `section` VARCHAR(191) NULL,
  `status` ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `dining_tables_restaurant_id_name_key`(`restaurant_id`, `name`),
  INDEX `dining_tables_restaurant_id_status_idx`(`restaurant_id`, `status`),
  CONSTRAINT `dining_tables_restaurant_id_fkey` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `restaurant_bookings` ADD COLUMN `table_id` VARCHAR(191) NULL;
CREATE INDEX `restaurant_bookings_table_id_date_time_idx` ON `restaurant_bookings`(`table_id`, `date`, `time`);
ALTER TABLE `restaurant_bookings` ADD CONSTRAINT `restaurant_bookings_table_id_fkey` FOREIGN KEY (`table_id`) REFERENCES `dining_tables`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `booking_preorders` (
  `id` VARCHAR(191) NOT NULL,
  `booking_id` VARCHAR(191) NOT NULL,
  `subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `total` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `booking_preorders_booking_id_key`(`booking_id`),
  CONSTRAINT `booking_preorders_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `restaurant_bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `booking_preorder_items` (
  `id` VARCHAR(191) NOT NULL,
  `preorder_id` VARCHAR(191) NOT NULL,
  `menu_item_id` VARCHAR(191) NOT NULL,
  `item_name` VARCHAR(191) NOT NULL,
  `unit_price` DECIMAL(10,2) NOT NULL,
  `quantity` INTEGER NOT NULL,
  `note` TEXT NULL,
  `line_total` DECIMAL(10,2) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `booking_preorder_items_preorder_id_idx`(`preorder_id`),
  INDEX `booking_preorder_items_menu_item_id_idx`(`menu_item_id`),
  CONSTRAINT `booking_preorder_items_preorder_id_fkey` FOREIGN KEY (`preorder_id`) REFERENCES `booking_preorders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
