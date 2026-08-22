-- AlterTable
ALTER TABLE `booking_events` MODIFY `type` ENUM('CREATED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'ROOM_CHANGED', 'ROOM_EXCHANGED', 'EXTENDED', 'CHARGE_ADDED', 'CHARGE_REMOVED', 'SERVICE_ADDED', 'SERVICE_UPDATED', 'SERVICE_REMOVED', 'RATE_PLAN_CHANGED', 'GUEST_ADDED', 'GUEST_UPDATED', 'GUEST_REMOVED', 'CANCELLED', 'AUTO_CANCELLED', 'REJECTED', 'EXPIRED', 'ADAPTER_SYNC_REQUESTED', 'NOTIFICATION_QUEUED') NOT NULL;

-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `rate_plan_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `booking_charges` (
    `id` VARCHAR(191) NOT NULL,
    `booking_id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `actor_type` VARCHAR(191) NOT NULL DEFAULT 'SYSTEM',
    `actor_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `booking_charges_booking_id_idx`(`booking_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_services` (
    `id` VARCHAR(191) NOT NULL,
    `booking_id` VARCHAR(191) NOT NULL,
    `service_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `booking_services_booking_id_idx`(`booking_id`),
    INDEX `booking_services_service_id_idx`(`service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_guests` (
    `id` VARCHAR(191) NOT NULL,
    `booking_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `booking_guests_booking_id_idx`(`booking_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `bookings_rate_plan_id_idx` ON `bookings`(`rate_plan_id`);

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_rate_plan_id_fkey` FOREIGN KEY (`rate_plan_id`) REFERENCES `rate_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_charges` ADD CONSTRAINT `booking_charges_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_services` ADD CONSTRAINT `booking_services_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_services` ADD CONSTRAINT `booking_services_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_guests` ADD CONSTRAINT `booking_guests_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
