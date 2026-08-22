-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'OWNER') NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `must_reset_password` BOOLEAN NOT NULL DEFAULT false,
    `business_name` VARCHAR(191) NULL,
    `setup_completed` BOOLEAN NOT NULL DEFAULT false,
    `current_step` ENUM('CATEGORY', 'ROOM_TYPE', 'ROOM', 'RATE_PLAN', 'SERVICE', 'COMPLETED') NOT NULL DEFAULT 'CATEGORY',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stay_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `owner_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('HOMESTAY', 'DHARAMSHALA', 'AIRBNB', 'HOTEL', 'RESORT', 'OTHER') NOT NULL,
    `description` TEXT NULL,
    `address_line` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'India',
    `pincode` VARCHAR(191) NOT NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `contact_number` VARCHAR(191) NOT NULL,
    `check_in_time` VARCHAR(191) NOT NULL DEFAULT '12:00',
    `check_out_time` VARCHAR(191) NOT NULL DEFAULT '10:00',
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `stay_profiles_owner_id_idx`(`owner_id`),
    INDEX `stay_profiles_city_type_status_idx`(`city`, `type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `amenities` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NULL,
    `applies_to` ENUM('STAY', 'ROOM', 'BOTH') NOT NULL DEFAULT 'BOTH',

    UNIQUE INDEX `amenities_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stay_amenities` (
    `id` VARCHAR(191) NOT NULL,
    `stay_profile_id` VARCHAR(191) NOT NULL,
    `amenity_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `stay_amenities_stay_profile_id_amenity_id_key`(`stay_profile_id`, `amenity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stay_images` (
    `id` VARCHAR(191) NOT NULL,
    `stay_profile_id` VARCHAR(191) NOT NULL,
    `image_url` VARCHAR(191) NOT NULL,
    `is_cover` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `stay_images_stay_profile_id_idx`(`stay_profile_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rooms` (
    `id` VARCHAR(191) NOT NULL,
    `stay_profile_id` VARCHAR(191) NOT NULL,
    `room_type_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `room_type` ENUM('SINGLE', 'DOUBLE', 'DORM', 'SUITE', 'FAMILY', 'HALL', 'OTHER') NOT NULL,
    `room_number` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `floor` VARCHAR(191) NULL,
    `physical_status` ENUM('AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE') NOT NULL DEFAULT 'AVAILABLE',
    `capacity_adults` INTEGER NOT NULL DEFAULT 1,
    `capacity_children` INTEGER NOT NULL DEFAULT 0,
    `base_price` DECIMAL(10, 2) NOT NULL,
    `extra_bed_price` DECIMAL(10, 2) NULL,
    `gst_type` ENUM('NONE', 'GST_5', 'GST_12', 'GST_18') NOT NULL DEFAULT 'NONE',
    `description` TEXT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_clean` BOOLEAN NOT NULL DEFAULT true,
    `is_bookable` BOOLEAN NOT NULL DEFAULT true,
    `show_on_website` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `rooms_stay_profile_id_idx`(`stay_profile_id`),
    INDEX `rooms_room_type_id_idx`(`room_type_id`),
    INDEX `rooms_room_type_status_idx`(`room_type`, `status`),
    INDEX `rooms_physical_status_idx`(`physical_status`),
    UNIQUE INDEX `rooms_stay_profile_id_room_number_key`(`stay_profile_id`, `room_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_categories` (
    `id` VARCHAR(191) NOT NULL,
    `property_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `featured_image` VARCHAR(191) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `property_categories_property_id_is_active_idx`(`property_id`, `is_active`),
    INDEX `property_categories_deleted_at_idx`(`deleted_at`),
    UNIQUE INDEX `property_categories_property_id_slug_key`(`property_id`, `slug`),
    UNIQUE INDEX `property_categories_property_id_name_key`(`property_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_types` (
    `id` VARCHAR(191) NOT NULL,
    `property_id` VARCHAR(191) NOT NULL,
    `category_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `overview` TEXT NULL,
    `key_features` JSON NULL,
    `policies` JSON NULL,
    `price_per_night` DECIMAL(10, 2) NOT NULL,
    `capacity` INTEGER NOT NULL DEFAULT 1,
    `max_adults` INTEGER NOT NULL DEFAULT 1,
    `max_children` INTEGER NOT NULL DEFAULT 0,
    `gst_type` ENUM('NONE', 'GST_5', 'GST_12', 'GST_18') NOT NULL DEFAULT 'NONE',
    `smoking_allowed` BOOLEAN NOT NULL DEFAULT false,
    `size_sq_ft` INTEGER NULL,
    `bed_type` VARCHAR(191) NULL,
    `ac_type` VARCHAR(191) NULL,
    `attached_bathroom` BOOLEAN NOT NULL DEFAULT true,
    `featured_image` VARCHAR(191) NULL,
    `gallery_images` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `room_types_property_id_category_id_idx`(`property_id`, `category_id`),
    INDEX `room_types_category_id_idx`(`category_id`),
    INDEX `room_types_is_active_idx`(`is_active`),
    INDEX `room_types_deleted_at_idx`(`deleted_at`),
    UNIQUE INDEX `room_types_property_id_slug_key`(`property_id`, `slug`),
    UNIQUE INDEX `room_types_property_id_name_key`(`property_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_type_amenities` (
    `id` VARCHAR(191) NOT NULL,
    `room_type_id` VARCHAR(191) NOT NULL,
    `amenity_id` VARCHAR(191) NOT NULL,

    INDEX `room_type_amenities_amenity_id_idx`(`amenity_id`),
    UNIQUE INDEX `room_type_amenities_room_type_id_amenity_id_key`(`room_type_id`, `amenity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rate_plans` (
    `id` VARCHAR(191) NOT NULL,
    `property_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `amount_type` ENUM('FLAT', 'PERCENTAGE') NOT NULL,
    `amount_value` DECIMAL(10, 2) NOT NULL,
    `applicability` ENUM('ALL', 'SPECIFIC_DAYS', 'DATE_RANGE', 'SPECIFIC_MONTHS', 'SPECIFIC_YEARS') NOT NULL DEFAULT 'ALL',
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `applicable_days` JSON NULL,
    `applicable_months` JSON NULL,
    `applicable_years` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `rate_plans_property_id_is_active_idx`(`property_id`, `is_active`),
    INDEX `rate_plans_deleted_at_idx`(`deleted_at`),
    UNIQUE INDEX `rate_plans_property_id_name_key`(`property_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rate_plan_room_types` (
    `id` VARCHAR(191) NOT NULL,
    `rate_plan_id` VARCHAR(191) NOT NULL,
    `room_type_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `rate_plan_room_types_room_type_id_idx`(`room_type_id`),
    UNIQUE INDEX `rate_plan_room_types_rate_plan_id_room_type_id_key`(`rate_plan_id`, `room_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `services` (
    `id` VARCHAR(191) NOT NULL,
    `property_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `gst_type` ENUM('NONE', 'GST_5', 'GST_12', 'GST_18') NOT NULL DEFAULT 'NONE',
    `images` JSON NULL,
    `is_available` BOOLEAN NOT NULL DEFAULT true,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `services_property_id_is_available_idx`(`property_id`, `is_available`),
    INDEX `services_deleted_at_idx`(`deleted_at`),
    UNIQUE INDEX `services_property_id_title_key`(`property_id`, `title`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_type_services` (
    `id` VARCHAR(191) NOT NULL,
    `room_type_id` VARCHAR(191) NOT NULL,
    `service_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `room_type_services_service_id_idx`(`service_id`),
    UNIQUE INDEX `room_type_services_room_type_id_service_id_key`(`room_type_id`, `service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rate_plan_services` (
    `id` VARCHAR(191) NOT NULL,
    `rate_plan_id` VARCHAR(191) NOT NULL,
    `service_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `rate_plan_services_service_id_idx`(`service_id`),
    UNIQUE INDEX `rate_plan_services_rate_plan_id_service_id_key`(`rate_plan_id`, `service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_availability` (
    `id` VARCHAR(191) NOT NULL,
    `service_id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `is_available` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `service_availability_service_id_idx`(`service_id`),
    UNIQUE INDEX `service_availability_service_id_date_key`(`service_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_amenities` (
    `id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `amenity_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `room_amenities_room_id_amenity_id_key`(`room_id`, `amenity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_images` (
    `id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `image_url` VARCHAR(191) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `room_images_room_id_idx`(`room_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_availability` (
    `id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `status` ENUM('AVAILABLE', 'UNAVAILABLE', 'BOOKED') NOT NULL DEFAULT 'AVAILABLE',
    `price_override` DECIMAL(10, 2) NULL,
    `booking_id` VARCHAR(191) NULL,

    INDEX `room_availability_booking_id_idx`(`booking_id`),
    UNIQUE INDEX `room_availability_room_id_date_key`(`room_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `id` VARCHAR(191) NOT NULL,
    `booking_ref` VARCHAR(191) NOT NULL,
    `stay_profile_id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `guest_name` VARCHAR(191) NOT NULL,
    `guest_phone` VARCHAR(191) NOT NULL,
    `guest_email` VARCHAR(191) NULL,
    `check_in_date` DATE NOT NULL,
    `check_out_date` DATE NOT NULL,
    `no_of_guests` INTEGER NOT NULL,
    `total_amount` DECIMAL(10, 2) NOT NULL,
    `booking_status` ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `payment_status` ENUM('UNPAID', 'PARTIAL', 'PAID', 'REFUNDED') NOT NULL DEFAULT 'UNPAID',
    `source` ENUM('DIRECT_SITE', 'PHONE', 'WALK_IN', 'ADMIN_ADDED', 'SAAS_ADAPTER') NOT NULL DEFAULT 'DIRECT_SITE',
    `owner_response_deadline` DATETIME(3) NULL,
    `responded_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bookings_booking_ref_key`(`booking_ref`),
    INDEX `bookings_stay_profile_id_idx`(`stay_profile_id`),
    INDEX `bookings_room_id_idx`(`room_id`),
    INDEX `bookings_booking_status_check_in_date_idx`(`booking_status`, `check_in_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `booking_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `payment_mode` ENUM('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER') NOT NULL,
    `transaction_ref` VARCHAR(191) NULL,
    `paid_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('SUCCESS', 'PENDING', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'SUCCESS',

    INDEX `payments_booking_id_idx`(`booking_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settlements` (
    `id` VARCHAR(191) NOT NULL,
    `owner_id` VARCHAR(191) NOT NULL,
    `stay_profile_id` VARCHAR(191) NULL,
    `period_start` DATE NOT NULL,
    `period_end` DATE NOT NULL,
    `total_booking_amount` DECIMAL(10, 2) NOT NULL,
    `commission_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `payable_amount` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PENDING',
    `paid_on` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `settlements_owner_id_idx`(`owner_id`),
    INDEX `settlements_stay_profile_id_idx`(`stay_profile_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settlement_items` (
    `id` VARCHAR(191) NOT NULL,
    `settlement_id` VARCHAR(191) NOT NULL,
    `booking_id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `stay_profile_id` VARCHAR(191) NOT NULL,
    `gross_amount` DECIMAL(10, 2) NOT NULL,
    `commission_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `payable_amount` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `settlement_items_settlement_id_idx`(`settlement_id`),
    INDEX `settlement_items_booking_id_idx`(`booking_id`),
    INDEX `settlement_items_room_id_idx`(`room_id`),
    INDEX `settlement_items_stay_profile_id_idx`(`stay_profile_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `type` ENUM('NEW_BOOKING_REQUEST', 'BOOKING_EXPIRING_SOON', 'BOOKING_EXPIRED', 'BOOKING_CONFIRMED', 'SETTLEMENT_PAID') NOT NULL,
    `booking_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `delivered_via` ENUM('REALTIME', 'PUSH', 'SMS', 'EMAIL') NOT NULL DEFAULT 'REALTIME',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_is_read_idx`(`user_id`, `is_read`),
    INDEX `notifications_booking_id_idx`(`booking_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NOT NULL,
    `meta` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_logs_user_id_idx`(`user_id`),
    INDEX `activity_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `stay_profiles` ADD CONSTRAINT `stay_profiles_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stay_amenities` ADD CONSTRAINT `stay_amenities_stay_profile_id_fkey` FOREIGN KEY (`stay_profile_id`) REFERENCES `stay_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stay_amenities` ADD CONSTRAINT `stay_amenities_amenity_id_fkey` FOREIGN KEY (`amenity_id`) REFERENCES `amenities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stay_images` ADD CONSTRAINT `stay_images_stay_profile_id_fkey` FOREIGN KEY (`stay_profile_id`) REFERENCES `stay_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_stay_profile_id_fkey` FOREIGN KEY (`stay_profile_id`) REFERENCES `stay_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_room_type_id_fkey` FOREIGN KEY (`room_type_id`) REFERENCES `room_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_categories` ADD CONSTRAINT `property_categories_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `stay_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_types` ADD CONSTRAINT `room_types_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `stay_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_types` ADD CONSTRAINT `room_types_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `property_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_type_amenities` ADD CONSTRAINT `room_type_amenities_room_type_id_fkey` FOREIGN KEY (`room_type_id`) REFERENCES `room_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_type_amenities` ADD CONSTRAINT `room_type_amenities_amenity_id_fkey` FOREIGN KEY (`amenity_id`) REFERENCES `amenities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rate_plans` ADD CONSTRAINT `rate_plans_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `stay_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rate_plan_room_types` ADD CONSTRAINT `rate_plan_room_types_rate_plan_id_fkey` FOREIGN KEY (`rate_plan_id`) REFERENCES `rate_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rate_plan_room_types` ADD CONSTRAINT `rate_plan_room_types_room_type_id_fkey` FOREIGN KEY (`room_type_id`) REFERENCES `room_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `services` ADD CONSTRAINT `services_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `stay_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_type_services` ADD CONSTRAINT `room_type_services_room_type_id_fkey` FOREIGN KEY (`room_type_id`) REFERENCES `room_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_type_services` ADD CONSTRAINT `room_type_services_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rate_plan_services` ADD CONSTRAINT `rate_plan_services_rate_plan_id_fkey` FOREIGN KEY (`rate_plan_id`) REFERENCES `rate_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rate_plan_services` ADD CONSTRAINT `rate_plan_services_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_availability` ADD CONSTRAINT `service_availability_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_amenities` ADD CONSTRAINT `room_amenities_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_amenities` ADD CONSTRAINT `room_amenities_amenity_id_fkey` FOREIGN KEY (`amenity_id`) REFERENCES `amenities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_images` ADD CONSTRAINT `room_images_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_availability` ADD CONSTRAINT `room_availability_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_availability` ADD CONSTRAINT `room_availability_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_stay_profile_id_fkey` FOREIGN KEY (`stay_profile_id`) REFERENCES `stay_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_stay_profile_id_fkey` FOREIGN KEY (`stay_profile_id`) REFERENCES `stay_profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlement_items` ADD CONSTRAINT `settlement_items_settlement_id_fkey` FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlement_items` ADD CONSTRAINT `settlement_items_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlement_items` ADD CONSTRAINT `settlement_items_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlement_items` ADD CONSTRAINT `settlement_items_stay_profile_id_fkey` FOREIGN KEY (`stay_profile_id`) REFERENCES `stay_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
