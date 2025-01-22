<?php
include 'db.php';

// Set CORS headers
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *"); // Replace * with your domain in production
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Validate POST data
$input = json_decode(file_get_contents('php://input'), true);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($input['room_id'], $input['room_name'], $input['admin_name'])) {
    $roomId = trim($input['room_id']);
    $roomName = trim($input['room_name']);
    $adminName = trim($input['admin_name']);

    // Check if required fields are empty
    if (empty($roomId) || empty($roomName) || empty($adminName)) {
        echo json_encode(['status' => 'error', 'message' => 'Room ID, Room Name, and Admin Name cannot be empty']);
        exit();
    }

    // Insert into PostgreSQL database
    $query = "INSERT INTO rooms (room_id, room_name, admin_name) VALUES ($1, $2, $3)";
    $result = pg_query_params($conn, $query, [$roomId, $roomName, $adminName]);

    if ($result) {
        echo json_encode(['status' => 'success', 'message' => 'Room created successfully']);
    } else {
        $error = pg_last_error($conn);
        echo json_encode(['status' => 'error', 'message' => 'Failed to create room: ' . $error]);
    }

    pg_close($conn);
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request. Please provide Room ID, Room Name, and Admin Name.']);
}
?>
