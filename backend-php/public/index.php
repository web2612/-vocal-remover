<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/autoload.php';

use VocalRemover\Admin\AdminManager;
use VocalRemover\Engine\ProviderManager;
use VocalRemover\Exceptions\ProviderException;
use VocalRemover\Ledger\QuotaLedger;
use VocalRemover\Storage\LocalStorage;

// Set up security headers and CORS
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
$allowedOrigins = ['https://vocalremover.group', 'https://staging.vocalremover.group', 'http://localhost:5173', 'http://localhost:8000', 'http://127.0.0.1:5173'];
if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Admin-Key, Idempotency-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Bootstrap Core Services
$config = require dirname(__DIR__) . '/config/providers.php';
$storage = new LocalStorage();
$ledger = new QuotaLedger();
$manager = new ProviderManager($ledger, $storage);

// Load overrides if any
$overridesFile = dirname(__DIR__) . '/storage/data/admin_overrides.json';
$overrides = file_exists($overridesFile) ? (json_decode(file_get_contents($overridesFile) ?: '{}', true) ?: []) : [];

// Instantiate and Register Providers
foreach ($config['providers'] as $id => $pConfig) {
    if (isset($overrides[$id]['enabled'])) {
        $pConfig['enabled'] = (bool)$overrides[$id]['enabled'];
    }
    if (isset($overrides[$id]['priority'])) {
        $pConfig['priority'] = (int)$overrides[$id]['priority'];
    }

    $class = $pConfig['class'];
    if (class_exists($class)) {
        $manager->registerProvider(new $class($pConfig, $ledger));
    }
}

$admin = new AdminManager($manager, $config);

// Route Dispatching
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
$method = $_SERVER['REQUEST_METHOD'];

// Helper to send JSON response
function sendJson(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

// 1. Session route (Cloudflare Worker compatibility)
if ($uri === '/api/v1/session' && $method === 'GET') {
    $token = bin2hex(random_bytes(16));
    sendJson(['session' => $token], 200);
}

// 2. Health check route
if ($uri === '/api/v1/health' || $uri === '/health') {
    sendJson(['status' => 'healthy', 'service' => 'VocalRemover API Manager', 'version' => '2.0.0'], 200);
}

// 3. Audio upload and separation route: POST /api/v1/jobs
if ($uri === '/api/v1/jobs' && $method === 'POST') {
    $uploadedFile = $_FILES['audio'] ?? $_FILES['file'] ?? $_FILES['input_audio'] ?? null;
    $tmpPath = null;
    $origName = 'audio.mp3';
    $format = 'mp3';

    if ($uploadedFile && is_uploaded_file($uploadedFile['tmp_name'])) {
        if ($uploadedFile['error'] !== UPLOAD_ERR_OK) {
            sendJson(['code' => 'upload_failed', 'message' => 'File upload error code: ' . $uploadedFile['error']], 400);
        }
        $tmpPath = $uploadedFile['tmp_name'];
        $origName = $uploadedFile['name'];
        $format = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
    } else {
        // Direct stream body
        $rawInput = file_get_contents('php://input');
        if (!empty($rawInput)) {
            $tmpPath = tempnam(sys_get_temp_dir(), 'vr_input_');
            file_put_contents($tmpPath, $rawInput);
            $format = (str_starts_with($rawInput, 'RIFF')) ? 'wav' : 'mp3';
        }
    }

    if (!$tmpPath || !file_exists($tmpPath) || filesize($tmpPath) < 12) {
        sendJson(['code' => 'invalid_audio', 'message' => 'Choose a valid MP3 or WAV audio file.'], 400);
    }

    if (filesize($tmpPath) > 100 * 1024 * 1024) {
        sendJson(['code' => 'too_large', 'message' => 'The file exceeds the 100 MB limit.'], 413);
    }

    // Inspect genuine audio duration, format, and headers
    $audioInfo = \VocalRemover\Utils\AudioInspector::inspect($tmpPath);
    if (!$audioInfo['valid']) {
        sendJson(['code' => 'invalid_audio', 'message' => 'Choose a valid MP3 or WAV audio file.'], 400);
    }

    $format = $audioInfo['format'];
    $durationSeconds = $audioInfo['duration_seconds'];

    if ($durationSeconds < 1.0) {
        sendJson(['code' => 'invalid_audio', 'message' => 'Audio must be at least 1 second in duration.'], 400);
    }
    if ($durationSeconds > 600.0) {
        sendJson(['code' => 'too_large', 'message' => 'Audio exceeds maximum duration of 10 minutes.'], 400);
    }

    // Store input in storage
    $storedInputKey = $storage->storeInput($tmpPath, $origName);
    $inputFullPath = $storage->getInputPath($storedInputKey);

    try {
        $result = $manager->processAudio($inputFullPath, $format, $durationSeconds, [
            'stored_input_key' => $storedInputKey,
            'original_name' => $origName,
            'sample_rate' => $audioInfo['sample_rate'],
            'channels' => $audioInfo['channels'],
            'bitrate_kbps' => $audioInfo['bitrate_kbps'],
        ]);

        sendJson([
            'id' => $result['job_id'],
            'state' => 'complete',
            'percent' => 100,
            'duration' => $result['duration'],
            'vocalsUrl' => $result['vocals_url'],
            'instrumentalUrl' => $result['instrumental_url'],
            'expiresAt' => $result['expires_at'],
            'provider' => $result['provider'],
        ], 200);
    } catch (ProviderException $pe) {
        sendJson([
            'code' => $pe->getErrorType(),
            'message' => $pe->getMessage(),
        ], $pe->getHttpStatus() ?? 503);
    } catch (\Throwable $t) {
        sendJson([
            'code' => 'unavailable',
            'message' => ProviderManager::BUSY_MESSAGE,
        ], 503);
    }
}

// 4. Stream stem: GET /api/v1/jobs/{id}/stems/{stem}
if (preg_match('#^/api/v1/jobs/([a-zA-Z0-9_-]+)/stems/(vocals|instrumental)$#', $uri, $matches)) {
    $jobId = $matches[1];
    $stem = $matches[2];

    // Verify token/signature if present
    $expires = (int)($_GET['expires'] ?? 0);
    $sig = (string)($_GET['sig'] ?? '');
    if ($expires > 0 && !empty($sig)) {
        if (!$storage->verifyStemSignature($jobId, $stem, $expires, $sig)) {
            sendJson(['code' => 'forbidden', 'message' => 'Invalid or expired signature.'], 403);
        }
    }

    $storage->streamStem($jobId, $stem);
    exit;
}

// 5. Temporary input endpoint for Karadeo: GET /api/v1/temporary-input/{filename}
if (preg_match('#^/api/v1/temporary-input/([a-zA-Z0-9_\.-]+)$#', $uri, $matches)) {
    $filename = $matches[1];
    $expires = (int)($_GET['expires'] ?? 0);
    $sig = (string)($_GET['sig'] ?? '');

    if (!$storage->verifyInputSignature($filename, $expires, $sig)) {
        sendJson(['code' => 'forbidden', 'message' => 'Invalid or expired temporary access token.'], 403);
    }

    $path = $storage->getInputPath($filename);
    if (!$path || !file_exists($path)) {
        sendJson(['code' => 'not_found', 'message' => 'File expired or deleted.'], 404);
    }

    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    header('Content-Type: ' . ($ext === 'wav' ? 'audio/wav' : 'audio/mpeg'));
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

// 6. Admin API Routes (Protected by X-Admin-Key or ADMIN_SECRET_KEY)
if (str_starts_with($uri, '/api/v1/admin/')) {
    $providedKey = $_SERVER['HTTP_X_ADMIN_KEY'] ?? $_GET['admin_key'] ?? '';
    $expectedKey = $config['settings']['admin_key'];

    if (empty($providedKey) || !hash_equals($expectedKey, $providedKey)) {
        sendJson(['error' => 'Unauthorized admin access. Please provide valid X-Admin-Key header.'], 401);
    }

    if ($uri === '/api/v1/admin/overview' && $method === 'GET') {
        sendJson($admin->getOverview(), 200);
    }

    if ($uri === '/api/v1/admin/provider/test' && $method === 'POST') {
        $body = json_decode(file_get_contents('php://input') ?: '{}', true);
        $providerId = (string)($body['provider_id'] ?? '');
        sendJson($admin->testProvider($providerId), 200);
    }

    if ($uri === '/api/v1/admin/provider/toggle' && $method === 'POST') {
        $body = json_decode(file_get_contents('php://input') ?: '{}', true);
        $providerId = (string)($body['provider_id'] ?? '');
        $enabled = (bool)($body['enabled'] ?? true);
        $admin->toggleProvider($providerId, $enabled);
        sendJson(['success' => true, 'provider_id' => $providerId, 'enabled' => $enabled], 200);
    }

    if ($uri === '/api/v1/admin/provider/priority' && $method === 'POST') {
        $body = json_decode(file_get_contents('php://input') ?: '{}', true);
        $providerId = (string)($body['provider_id'] ?? '');
        $priority = (int)($body['priority'] ?? 10);
        $admin->updatePriority($providerId, $priority);
        sendJson(['success' => true, 'provider_id' => $providerId, 'priority' => $priority], 200);
    }

    if ($uri === '/api/v1/admin/provider/reset' && $method === 'POST') {
        $body = json_decode(file_get_contents('php://input') ?: '{}', true);
        $providerId = (string)($body['provider_id'] ?? '');
        $admin->resetProviderCooldown($providerId);
        sendJson(['success' => true, 'provider_id' => $providerId, 'message' => 'Cooldown cleared.'], 200);
    }

    sendJson(['error' => 'Unknown admin endpoint.'], 404);
}

// Default 404
sendJson(['code' => 'not_found', 'message' => 'Endpoint not found.'], 404);
