<?php

declare(strict_types=1);

return [
    'providers' => [
        // Provider 1: SplitBeat (RapidAPI)
        // Endpoint: POST https://splitbeat-vocal-remover-music-splitter.p.rapidapi.com/Upload_audio
        'splitbeat' => [
            'class' => \VocalRemover\Providers\SplitBeatProvider::class,
            'enabled' => filter_var(getenv('SPLITBEAT_ENABLED') ?: 'true', FILTER_VALIDATE_BOOLEAN),
            'priority' => (int)(getenv('SPLITBEAT_PRIORITY') ?: 1),
            'rapidapi_host' => getenv('SPLITBEAT_RAPIDAPI_HOST') ?: 'splitbeat-vocal-remover-music-splitter.p.rapidapi.com',
            'rapidapi_key' => getenv('RAPIDAPI_KEY') ?: getenv('SPLITBEAT_RAPIDAPI_KEY') ?: '',
            'endpoint' => 'https://splitbeat-vocal-remover-music-splitter.p.rapidapi.com/Upload_audio',
            // No assumed quotas - only track if explicitly specified by operator
            'daily_quota' => getenv('SPLITBEAT_DAILY_QUOTA') ? (int)getenv('SPLITBEAT_DAILY_QUOTA') : null,
            'monthly_quota' => getenv('SPLITBEAT_MONTHLY_QUOTA') ? (int)getenv('SPLITBEAT_MONTHLY_QUOTA') : null,
            'timeout' => 180,
            'max_duration_seconds' => 600,
            'supported_formats' => ['mp3', 'wav'],
            'production_ready' => false, // Will become true only when credentials are confirmed
        ],

        // Provider 2: Voice Separation API (RapidAPI)
        // Endpoint: POST https://voice-separation-api.p.rapidapi.com/api/rapidapi/separate-audio
        'voice_separation' => [
            'class' => \VocalRemover\Providers\VoiceSeparationProvider::class,
            'enabled' => filter_var(getenv('VOICE_SEPARATION_ENABLED') ?: 'true', FILTER_VALIDATE_BOOLEAN),
            'priority' => (int)(getenv('VOICE_SEPARATION_PRIORITY') ?: 2),
            'rapidapi_host' => getenv('VOICE_SEPARATION_RAPIDAPI_HOST') ?: 'voice-separation-api.p.rapidapi.com',
            'rapidapi_key' => getenv('RAPIDAPI_KEY') ?: getenv('VOICE_SEPARATION_RAPIDAPI_KEY') ?: '',
            'endpoint' => 'https://voice-separation-api.p.rapidapi.com/api/rapidapi/separate-audio',
            // No assumed quotas
            'daily_quota' => getenv('VOICE_SEPARATION_DAILY_QUOTA') ? (int)getenv('VOICE_SEPARATION_DAILY_QUOTA') : null,
            'monthly_quota' => getenv('VOICE_SEPARATION_MONTHLY_QUOTA') ? (int)getenv('VOICE_SEPARATION_MONTHLY_QUOTA') : null,
            'timeout' => 180,
            'max_duration_seconds' => 600,
            'supported_formats' => ['mp3', 'wav'],
            'production_ready' => false,
        ],

        // Provider 3: Disband (api.disband.io)
        // Docs: https://disband.io/docs
        // Live Quota: GET /usage
        'disband' => [
            'class' => \VocalRemover\Providers\DisbandProvider::class,
            'enabled' => filter_var(getenv('DISBAND_ENABLED') ?: 'true', FILTER_VALIDATE_BOOLEAN),
            'priority' => (int)(getenv('DISBAND_PRIORITY') ?: 3),
            'base_url' => getenv('DISBAND_BASE_URL') ?: 'https://api.disband.io/v1',
            'api_key' => getenv('DISBAND_KEY') ?: '',
            // Actual quota is retrieved dynamically from GET /usage
            'daily_quota' => null,
            'monthly_quota' => null,
            'timeout' => 60,
            'max_polling_seconds' => 180,
            'max_duration_seconds' => 600,
            'supported_formats' => ['mp3', 'wav'],
            'production_ready' => false,
        ],

        // Provider 4: Karadeo (karadeo.com)
        // Docs: https://karadeo.com/api/vocal-remover/doc
        'karadeo' => [
            'class' => \VocalRemover\Providers\KaradeoProvider::class,
            'enabled' => filter_var(getenv('KARADEO_ENABLED') ?: 'true', FILTER_VALIDATE_BOOLEAN),
            'priority' => (int)(getenv('KARADEO_PRIORITY') ?: 4),
            'endpoint' => getenv('KARADEO_ENDPOINT') ?: 'https://karadeo.com/api/vocal-remover',
            'api_key' => getenv('KARADEO_API_KEY') ?: '',
            // No assumed quotas
            'daily_quota' => getenv('KARADEO_DAILY_QUOTA') ? (int)getenv('KARADEO_DAILY_QUOTA') : null,
            'monthly_quota' => getenv('KARADEO_MONTHLY_QUOTA') ? (int)getenv('KARADEO_MONTHLY_QUOTA') : null,
            'timeout' => 180,
            'max_duration_seconds' => 600,
            'supported_formats' => ['mp3', 'wav'],
            'production_ready' => false,
        ],

        // Provider 5: StemConsole (stemconsole.ai)
        // Docs: https://stemconsole.ai/developers/
        'stemconsole' => [
            'class' => \VocalRemover\Providers\StemConsoleProvider::class,
            'enabled' => filter_var(getenv('STEMCONSOLE_ENABLED') ?: 'true', FILTER_VALIDATE_BOOLEAN),
            'priority' => (int)(getenv('STEMCONSOLE_PRIORITY') ?: 5),
            'base_url' => getenv('STEMCONSOLE_BASE_URL') ?: 'https://api.stemconsole.ai/v1',
            'api_key' => getenv('STEMCONSOLE_API_KEY') ?: '',
            // Free plan officially documented as 5 songs monthly
            'daily_quota' => null,
            'monthly_quota' => 5,
            'timeout' => 60,
            'max_polling_seconds' => 180,
            'max_duration_seconds' => 600,
            'supported_formats' => ['mp3', 'wav'],
            'production_ready' => false,
        ],

        // Provider 6: AudioShake (Standby / Future Provider)
        'audioshake' => [
            'class' => \VocalRemover\Providers\AudioShakeProvider::class,
            'enabled' => false, // Explicitly disabled
            'priority' => 10,
            'api_key' => getenv('AUDIOSHAKE_API_KEY') ?: '',
            'daily_quota' => null,
            'monthly_quota' => null,
            'supported_formats' => ['mp3', 'wav'],
            'production_ready' => false,
        ],
    ],

    'settings' => [
        'app_url' => getenv('APP_URL') ?: 'http://localhost:8000',
        'admin_key' => getenv('ADMIN_SECRET_KEY') ?: 'admin_secret_key_vocalremover_2026',
        'max_file_size_mb' => 100,
        'max_duration_seconds' => 600,
        'cleanup_interval_seconds' => 86400,
    ],
];
