<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'Method not allowed']);
  exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['name']) || !isset($input['score'])) {
  http_response_code(400);
  echo json_encode(['error' => 'Missing name or score']);
  exit;
}

$name = trim(substr($input['name'], 0, 20));
$score = (int) $input['score'];

$stmt = $pdo->prepare('INSERT INTO scores (name, score) VALUES (:name, :score)');
$stmt->execute([':name' => $name, ':score' => $score]);

echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);