ALTER TABLE `bookings`
  MODIFY `booking_status` ENUM('PENDING','CONFIRMED','CANCELLED','COMPLETED','EXPIRED','AUTO_CANCELLED','REJECTED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `expires_at` DATETIME(3) NULL,
  ADD COLUMN `confirmed_at` DATETIME(3) NULL,
  ADD COLUMN `cancelled_at` DATETIME(3) NULL,
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;

CREATE INDEX `bookings_booking_status_expires_at_idx` ON `bookings`(`booking_status`, `expires_at`);

CREATE TABLE `booking_events` (
  `id` VARCHAR(191) NOT NULL,
  `booking_id` VARCHAR(191) NOT NULL,
  `type` ENUM('CREATED','CONFIRMED','CANCELLED','AUTO_CANCELLED','REJECTED','EXPIRED','ADAPTER_SYNC_REQUESTED','NOTIFICATION_QUEUED') NOT NULL,
  `from_status` ENUM('PENDING','CONFIRMED','CANCELLED','COMPLETED','EXPIRED','AUTO_CANCELLED','REJECTED') NULL,
  `to_status` ENUM('PENDING','CONFIRMED','CANCELLED','COMPLETED','EXPIRED','AUTO_CANCELLED','REJECTED') NULL,
  `actor_type` VARCHAR(191) NOT NULL DEFAULT 'SYSTEM',
  `actor_id` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `booking_events_booking_id_created_at_idx`(`booking_id`, `created_at`),
  INDEX `booking_events_type_idx`(`type`),
  CONSTRAINT `booking_events_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
