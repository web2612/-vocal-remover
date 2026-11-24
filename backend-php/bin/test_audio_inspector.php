<?php

require_once dirname(__DIR__) . '/src/autoload.php';

use VocalRemover\Utils\AudioInspector;

$mp3File = dirname(__DIR__, 2) . '/public/demo-vocals.mp3';
$instFile = dirname(__DIR__, 2) . '/public/demo-instrumental.mp3';

echo "Testing AudioInspector on real files:\n\n";

if (file_exists($mp3File)) {
    $mp3 = AudioInspector::inspect($mp3File);
    echo "1. MP3 Vocal File ({$mp3File}):\n";
    echo "   Format: {$mp3['format']}\n";
    echo "   Duration: {$mp3['duration_seconds']}s\n";
    echo "   Sample Rate: {$mp3['sample_rate']} Hz\n";
    echo "   Channels: {$mp3['channels']}\n";
    echo "   Bitrate: {$mp3['bitrate_kbps']} kbps\n";
    echo "   Valid: " . ($mp3['valid'] ? 'YES' : 'NO') . "\n\n";
} else {
    echo "MP3 file not found: {$mp3File}\n";
}

if (file_exists($instFile)) {
    $inst = AudioInspector::inspect($instFile);
    echo "2. MP3 Instrumental File ({$instFile}):\n";
    echo "   Format: {$inst['format']}\n";
    echo "   Duration: {$inst['duration_seconds']}s\n";
    echo "   Sample Rate: {$inst['sample_rate']} Hz\n";
    echo "   Channels: {$inst['channels']}\n";
    echo "   Bitrate: {$inst['bitrate_kbps']} kbps\n";
    echo "   Valid: " . ($inst['valid'] ? 'YES' : 'NO') . "\n\n";
} else {
    echo "Instrumental file not found: {$instFile}\n";
}
