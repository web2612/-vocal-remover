<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/autoload.php';

use VocalRemover\Engine\ProviderManager;
use VocalRemover\Ledger\QuotaLedger;
use VocalRemover\Storage\LocalStorage;

echo "========================================================\n";
echo "   VocalRemover.group Multi-Provider Diagnostic CLI     \n";
echo "========================================================\n\n";

$config = require dirname(__DIR__) . '/config/providers.php';
$storage = new LocalStorage();
$ledger = new QuotaLedger();
$manager = new ProviderManager($ledger, $storage);

foreach ($config['providers'] as $id => $pConfig) {
    $class = $pConfig['class'];
    if (class_exists($class)) {
        $manager->registerProvider(new $class($pConfig, $ledger));
    }
}

$providers = $manager->getProviders();
echo "Configured Providers: " . count($providers) . "\n\n";

printf("%-18s | %-8s | %-8s | %-12s | %-15s | %-15s\n", "Provider ID", "Enabled", "Priority", "Credentials", "Daily Quota", "Monthly Quota");
echo str_repeat("-", 90) . "\n";

foreach ($providers as $id => $p) {
    $quota = $p->getQuotaStatus();
    $hasCreds = $p->hasValidCredentials() ? "Configured" : "Missing";
    $daily = ($quota['daily_limit'] !== null) ? "{$quota['daily_used']}/{$quota['daily_limit']}" : "Unlimited";
    $monthly = ($quota['monthly_limit'] !== null) ? "{$quota['monthly_used']}/{$quota['monthly_limit']}" : "Unlimited";

    printf("%-18s | %-8s | %-8d | %-12s | %-15s | %-15s\n",
        $id,
        $p->isEnabled() ? "Yes" : "No",
        $p->getPriority(),
        $hasCreds,
        $daily,
        $monthly
    );
}

echo "\n--- Running Connectivity Tests ---\n";
foreach ($providers as $id => $p) {
    if (!$p->isEnabled()) {
        echo "[SKIP] {$id} is disabled.\n";
        continue;
    }
    echo "[TEST] Testing {$id}... ";
    $res = $p->testConnection();
    if ($res['success']) {
        echo "SUCCESS ({$res['latency_ms']}ms) - {$res['message']}\n";
    } else {
        echo "FAILED - {$res['message']}\n";
    }
}

echo "\nDiagnostic completed successfully.\n";
