-- CreateTable
CREATE TABLE `restaurant_users` (
    `id` VARCHAR(191) NOT NULL,
    `firebase_uid` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `player_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `restaurant_users_firebase_uid_key`(`firebase_uid`),
    UNIQUE INDEX `restaurant_users_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `restaurant_user_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `replaced_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_sessions_token_hash_key`(`token_hash`),
    INDEX `refresh_sessions_restaurant_user_id_idx`(`restaurant_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_users` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPERADMIN', 'ADMIN') NOT NULL DEFAULT 'ADMIN',
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_restaurants` (
    `id` VARCHAR(191) NOT NULL,
    `admin_id` VARCHAR(191) NOT NULL,
    `restaurant_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_restaurants_restaurant_id_idx`(`restaurant_id`),
    UNIQUE INDEX `admin_restaurants_admin_id_restaurant_id_key`(`admin_id`, `restaurant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `restaurant_categories` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `restaurant_categories_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `restaurant_category_links` (
    `id` VARCHAR(191) NOT NULL,
    `restaurant_id` VARCHAR(191) NOT NULL,
    `category_id` VARCHAR(191) NOT NULL,

    INDEX `restaurant_category_links_category_id_idx`(`category_id`),
    UNIQUE INDEX `restaurant_category_links_restaurant_id_category_id_key`(`restaurant_id`, `category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `restaurants` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `banner` VARCHAR(1024) NULL,
    `gallery` JSON NULL,
    `cuisine_label` VARCHAR(191) NOT NULL,
    `is_pure_veg` BOOLEAN NOT NULL DEFAULT false,
    `rating` DECIMAL(2, 1) NOT NULL DEFAULT 0,
    `rating_count` INTEGER NOT NULL DEFAULT 0,
    `prep_time_min` INTEGER NOT NULL,
    `prep_time_max` INTEGER NOT NULL,
    `price_for_two` INTEGER NOT NULL,
    `offer_text` VARCHAR(191) NULL,
    `offer_sub_text` VARCHAR(191) NULL,
    `about` TEXT NULL,
    `address_line` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'India',
    `pincode` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NOT NULL,
    `latitude` DECIMAL(10, 7) NOT NULL,
    `longitude` DECIMAL(10, 7) NOT NULL,
    `seating_capacity` INTEGER NOT NULL DEFAULT 40,
    `max_party_size` INTEGER NOT NULL DEFAULT 12,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `restaurants_city_status_idx`(`city`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_categories` (
    `id` VARCHAR(191) NOT NULL,
    `restaurant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `menu_categories_restaurant_id_sort_order_idx`(`restaurant_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_items` (
    `id` VARCHAR(191) NOT NULL,
    `menu_category_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `image` VARCHAR(1024) NULL,
    `is_veg` BOOLEAN NOT NULL DEFAULT true,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `menu_items_menu_category_id_sort_order_idx`(`menu_category_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `slot_configurations` (
    `id` VARCHAR(191) NOT NULL,
    `restaurant_id` VARCHAR(191) NOT NULL,
    `meal` ENUM('LUNCH', 'DINNER') NOT NULL,
    `time` VARCHAR(5) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `slot_configurations_restaurant_id_is_active_idx`(`restaurant_id`, `is_active`),
    UNIQUE INDEX `slot_configurations_restaurant_id_meal_time_key`(`restaurant_id`, `meal`, `time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `restaurant_bookings` (
    `id` VARCHAR(191) NOT NULL,
    `human_booking_id` VARCHAR(191) NOT NULL,
    `restaurant_id` VARCHAR(191) NOT NULL,
    `restaurant_user_id` VARCHAR(191) NOT NULL,
    `restaurant_name_snapshot` VARCHAR(191) NOT NULL,
    `restaurant_image_snapshot` VARCHAR(1024) NULL,
    `rating_snapshot` DECIMAL(2, 1) NOT NULL,
    `cuisine_label_snapshot` VARCHAR(191) NOT NULL,
    `distance_km_snapshot` DECIMAL(6, 2) NULL,
    `date` DATE NOT NULL,
    `time` VARCHAR(5) NOT NULL,
    `people` INTEGER NOT NULL,
    `table_preference` ENUM('ANY', 'WINDOW', 'INDOOR', 'OUTDOOR') NOT NULL DEFAULT 'ANY',
    `special_request` TEXT NULL,
    `full_name` VARCHAR(191) NOT NULL,
    `mobile_number` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `status` ENUM('UPCOMING', 'CANCELLED') NOT NULL DEFAULT 'UPCOMING',
    `cancellation_reason` ENUM('CHANGE_OF_PLANS', 'BOOKED_BY_MISTAKE', 'FOUND_BETTER_OPTION', 'RESTAURANT_NOT_RESPONDING', 'OTHER') NULL,
    `cancelled_at` DATETIME(3) NULL,
    `advance_paid` DECIMAL(10, 2) NOT NULL,
    `payment_id` VARCHAR(191) NOT NULL,
    `refund_eligible` BOOLEAN NULL,
    `refund_amount` DECIMAL(10, 2) NULL,
    `reminder_job_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `restaurant_bookings_human_booking_id_key`(`human_booking_id`),
    UNIQUE INDEX `restaurant_bookings_payment_id_key`(`payment_id`),
    INDEX `restaurant_bookings_restaurant_id_date_time_idx`(`restaurant_id`, `date`, `time`),
    INDEX `restaurant_bookings_restaurant_user_id_status_idx`(`restaurant_user_id`, `status`),
    INDEX `restaurant_bookings_status_date_idx`(`status`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `restaurant_user_id` VARCHAR(191) NOT NULL,
    `razorpay_order_id` VARCHAR(191) NOT NULL,
    `razorpay_payment_id` VARCHAR(191) NULL,
    `razorpay_signature` VARCHAR(191) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `status` ENUM('CREATED', 'VERIFIED', 'FAILED') NOT NULL DEFAULT 'CREATED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_razorpay_order_id_key`(`razorpay_order_id`),
    UNIQUE INDEX `payments_razorpay_payment_id_key`(`razorpay_payment_id`),
    INDEX `payments_restaurant_user_id_idx`(`restaurant_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `restaurant_user_id` VARCHAR(191) NOT NULL,
    `type` ENUM('BOOKING_CONFIRMED', 'BOOKING_MODIFIED', 'BOOKING_CANCELLED', 'BOOKING_REMINDER') NOT NULL,
    `booking_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_restaurant_user_id_is_read_idx`(`restaurant_user_id`, `is_read`),
    INDEX `notifications_booking_id_idx`(`booking_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_sessions` ADD CONSTRAINT `refresh_sessions_restaurant_user_id_fkey` FOREIGN KEY (`restaurant_user_id`) REFERENCES `restaurant_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_restaurants` ADD CONSTRAINT `admin_restaurants_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_restaurants` ADD CONSTRAINT `admin_restaurants_restaurant_id_fkey` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `restaurant_category_links` ADD CONSTRAINT `restaurant_category_links_restaurant_id_fkey` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `restaurant_category_links` ADD CONSTRAINT `restaurant_category_links_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `restaurant_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_categories` ADD CONSTRAINT `menu_categories_restaurant_id_fkey` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_menu_category_id_fkey` FOREIGN KEY (`menu_category_id`) REFERENCES `menu_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `slot_configurations` ADD CONSTRAINT `slot_configurations_restaurant_id_fkey` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `restaurant_bookings` ADD CONSTRAINT `restaurant_bookings_restaurant_id_fkey` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `restaurant_bookings` ADD CONSTRAINT `restaurant_bookings_restaurant_user_id_fkey` FOREIGN KEY (`restaurant_user_id`) REFERENCES `restaurant_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `restaurant_bookings` ADD CONSTRAINT `restaurant_bookings_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_restaurant_user_id_fkey` FOREIGN KEY (`restaurant_user_id`) REFERENCES `restaurant_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_restaurant_user_id_fkey` FOREIGN KEY (`restaurant_user_id`) REFERENCES `restaurant_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `restaurant_bookings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

