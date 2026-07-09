<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['error' => 'Method not allowed']);
  exit;
}

$stmt = $pdo->query('SELECT name, score FROM scores ORDER BY score DESC LIMIT 10');
$scores = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($scores ?: []);