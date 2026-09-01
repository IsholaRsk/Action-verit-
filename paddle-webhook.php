<?php
// PADDLE WEBHOOK - https://escortepointfr.store/paddle-webhook.php
// Reçoit notifications Paddle Billing et met à jour Supabase
// ENV requis: PADDLE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

header('Content-Type: application/json');

// 1. ENV
$webhookSecret = getenv('PADDLE_WEBHOOK_SECRET') ?: $_ENV['PADDLE_WEBHOOK_SECRET'] ?? '';
$supabaseUrl = getenv('SUPABASE_URL') ?: $_ENV['SUPABASE_URL'] ?? 'https://desgfxqfmuqkslzntefg.supabase.co';
$serviceKey = getenv('SUPABASE_SERVICE_ROLE_KEY') ?: $_ENV['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

if (!$webhookSecret) {
    http_response_code(500);
    echo json_encode(['error' => 'PADDLE_WEBHOOK_SECRET manquant - config .env']);
    exit;
}

// 2. RECUPERE PAYLOAD BRUT + SIGNATURE
$payload = file_get_contents('php://input');
$signatureHeader = $_SERVER['HTTP_PADDLE_SIGNATURE'] ?? '';

if (!$payload) {
    http_response_code(400);
    echo json_encode(['error' => 'Payload vide']);
    exit;
}

// 3. VERIF SIGNATURE PADDLE (IMPORTANT SECURITE)
// Format: ts=1234567890;h1=abc123...
function verifyPaddleSignature($payload, $signatureHeader, $secret) {
    if (!$signatureHeader) return false;
    $parts = [];
    foreach (explode(';', $signatureHeader) as $pair) {
        $kv = explode('=', $pair, 2);
        if (count($kv) == 2) $parts[trim($kv[0])] = trim($kv[1]);
    }
    $ts = $parts['ts'] ?? '';
    $h1 = $parts['h1'] ?? '';
    if (!$ts || !$h1) return false;
    // Paddle signe ts:payload
    $signedPayload = $ts . ':' . $payload;
    $computed = hash_hmac('sha256', $signedPayload, $secret);
    return hash_equals($computed, $h1);
}

if (!verifyPaddleSignature($payload, $signatureHeader, $webhookSecret)) {
    // Log pour debug mais refuse
    error_log("Paddle webhook signature invalide: $signatureHeader");
    http_response_code(401);
    echo json_encode(['error' => 'Signature invalide - ne fait pas confiance frontend']);
    exit;
}

// 4. PARSE JSON
$event = json_decode($payload, true);
if (!$event) {
    http_response_code(400);
    echo json_encode(['error' => 'JSON invalide']);
    exit;
}

$eventType = $event['event_type'] ?? 'unknown';
$data = $event['data'] ?? [];

// 5. EXTRACTION DONNEES COMMUNES
// Paddle Billing structure: data contient subscription, customer, etc.
$subscriptionId = $data['id'] ?? $data['subscription_id'] ?? null;
$customerId = $data['customer_id'] ?? $data['customer']['id'] ?? null;
$status = $data['status'] ?? 'inactive';
$priceId = null;
$currentStart = null;
$currentEnd = null;
$nextBilled = null;
$userId = null;

// Custom data contient user_id passé depuis frontend
$customData = $data['custom_data'] ?? $data['customData'] ?? [];
if (is_array($customData)) {
    $userId = $customData['user_id'] ?? $customData['userId'] ?? null;
}

// Pour subscription events, price ID dans items[0]
if (isset($data['items'][0]['price']['id'])) {
    $priceId = $data['items'][0]['price']['id'];
} elseif (isset($data['price_id'])) {
    $priceId = $data['price_id'];
} else {
    $priceId = 'pri_01m1e8e2ybr9rjmaq0kz4ezpnk'; // fallback price demandé
}

// Dates
$currentStart = $data['current_billing_period']['starts_at'] ?? $data['started_at'] ?? null;
$currentEnd = $data['current_billing_period']['ends_at'] ?? $data['next_billed_at'] ?? null;
$nextBilled = $data['next_billed_at'] ?? $currentEnd;

// Si pas de user_id dans custom_data, cherche via customer_id dans DB
function supabaseRequest($url, $key, $method, $path, $body = null) {
    $ch = curl_init($url . $path);
    $headers = [
        "apikey: $key",
        "Authorization: Bearer $key",
        "Content-Type: application/json",
        "Prefer: resolution=merge-duplicates"
    ];
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    if ($body) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => json_decode($res, true), 'raw' => $res];
}

if (!$userId && $customerId) {
    // Cherche user_id via customer_id existant
    $res = supabaseRequest($supabaseUrl, $serviceKey, 'GET', "/rest/v1/paddle_subscriptions?paddle_customer_id=eq.$customerId&select=user_id");
    if ($res['code'] == 200 && !empty($res['body'][0]['user_id'])) {
        $userId = $res['body'][0]['user_id'];
    }
}

// Si toujours pas de user_id, on ne peut pas associer - log et ignore (ou crée entrée sans user si besoin)
if (!$userId && in_array($eventType, ['subscription_created','subscription_activated','subscription_updated','transaction_completed','transaction_paid'])) {
    error_log("Paddle webhook: user_id manquant pour event $eventType, customer $customerId, sub $subscriptionId");
    // On continue quand même si subscription_id existe, on essaiera update par subscription_id
}

// 6. MAP STATUS PADDLE -> NOTRE STATUS
$statusMap = [
    'active' => 'active',
    'trialing' => 'trialing',
    'past_due' => 'past_due',
    'paused' => 'paused',
    'canceled' => 'canceled',
    'expired' => 'expired',
    'unpaid' => 'unpaid'
];
$mappedStatus = $statusMap[$status] ?? $status;

// Events qui doivent activer premium
$activateEvents = ['subscription_created','subscription_activated','subscription_updated','transaction_completed','transaction_paid','subscription_resumed'];
// Events qui désactivent
$deactivateEvents = ['subscription_canceled','subscription_expired','subscription_paused','subscription_past_due'];

$isActive = in_array($mappedStatus, ['active','trialing']);

// 7. UPDATE SUPABASE
if ($subscriptionId || $userId) {
    $upsertData = [
        'paddle_customer_id' => $customerId,
        'paddle_subscription_id' => $subscriptionId,
        'price_id' => $priceId,
        'status' => $mappedStatus,
        'current_period_start' => $currentStart,
        'current_period_end' => $currentEnd,
        'next_billed_at' => $nextBilled,
        'updated_at' => date('c'),
        'data' => $event
    ];
    
    if ($userId) $upsertData['user_id'] = $userId;

    // Upsert par user_id si on l'a, sinon par subscription_id
    if ($userId) {
        $res = supabaseRequest($supabaseUrl, $serviceKey, 'POST', "/rest/v1/paddle_subscriptions?on_conflict=user_id", $upsertData);
    } else if ($subscriptionId) {
        $res = supabaseRequest($supabaseUrl, $serviceKey, 'POST', "/rest/v1/paddle_subscriptions?on_conflict=paddle_subscription_id", $upsertData);
    }

    // Log résultat
    error_log("Paddle webhook $eventType: user $userId sub $subscriptionId status $mappedStatus code {$res['code']}");

    // Si échec, retourne erreur pour que Paddle retry
    if ($res['code'] >= 400) {
        http_response_code(500);
        echo json_encode(['error' => 'Supabase update failed', 'details' => $res['raw']]);
        exit;
    }
}

// 8. REPONSE OK PADDLE
http_response_code(200);
echo json_encode([
    'received' => true,
    'event' => $eventType,
    'subscription_id' => $subscriptionId,
    'status' => $mappedStatus,
    'user_id' => $userId,
    'premium_active' => $isActive
]);
