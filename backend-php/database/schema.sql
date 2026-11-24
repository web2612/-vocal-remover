-- VocalRemover.group Multi-Provider Engine Schema
-- Database Engine: MySQL 8+ / MariaDB 10.5+

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Providers Configuration & Status
CREATE TABLE IF NOT EXISTS `providers` (
    `id` VARCHAR(50) NOT NULL PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `priority` INT NOT NULL DEFAULT 10,
    `has_credentials` TINYINT(1) NOT NULL DEFAULT 0,
    `daily_quota_limit` INT NULL,
    `monthly_quota_limit` INT NULL,
    `remaining_credits` INT NULL,
    `is_confirmed_quota` TINYINT(1) NOT NULL DEFAULT 0,
    `endpoint_url` VARCHAR(255) NULL,
    `timeout_seconds` INT NOT NULL DEFAULT 120,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Audio Jobs Ledger
CREATE TABLE IF NOT EXISTS `audio_jobs` (
    `id` VARCHAR(64) NOT NULL PRIMARY KEY,
    `session_id` VARCHAR(64) NULL,
    `provider_id` VARCHAR(50) NOT NULL,
    `input_filename` VARCHAR(255) NOT NULL,
    `format` VARCHAR(10) NOT NULL DEFAULT 'mp3',
    `file_bytes` BIGINT NOT NULL DEFAULT 0,
    `duration_seconds` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    `state` ENUM('queued', 'validating', 'processing', 'exporting', 'complete', 'failed', 'cancelled') NOT NULL DEFAULT 'queued',
    `percent` INT NOT NULL DEFAULT 0,
    `vocals_stem_key` VARCHAR(255) NULL,
    `instrumental_stem_key` VARCHAR(255) NULL,
    `provider_job_id` VARCHAR(128) NULL,
    `failover_count` INT NOT NULL DEFAULT 0,
    `error_code` VARCHAR(50) NULL,
    `error_message` TEXT NULL,
    `expires_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `completed_at` TIMESTAMP NULL,
    INDEX `idx_jobs_provider` (`provider_id`),
    INDEX `idx_jobs_state` (`state`),
    INDEX `idx_jobs_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Atomic Usage Ledger
CREATE TABLE IF NOT EXISTS `usage_ledger` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `provider_id` VARCHAR(50) NOT NULL,
    `job_id` VARCHAR(64) NULL,
    `date_utc` DATE NOT NULL,
    `month_utc` VARCHAR(7) NOT NULL,
    `duration_seconds` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    `success` TINYINT(1) NOT NULL DEFAULT 1,
    `is_confirmed` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_usage_provider_date` (`provider_id`, `date_utc`),
    INDEX `idx_usage_provider_month` (`provider_id`, `month_utc`),
    INDEX `idx_usage_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Provider Audit & Failover Logs
CREATE TABLE IF NOT EXISTS `provider_logs` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `provider_id` VARCHAR(50) NOT NULL,
    `job_id` VARCHAR(64) NULL,
    `level` ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL') NOT NULL DEFAULT 'INFO',
    `message` TEXT NOT NULL,
    `http_status` INT NULL,
    `latency_ms` INT NULL,
    `context_json` JSON NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_logs_provider` (`provider_id`),
    INDEX `idx_logs_level` (`level`),
    INDEX `idx_logs_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
