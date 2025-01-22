<?php
// Database configuration
$host = "db.pezdqmellmcmewcvssbv.supabase.co"; // Replace with your Supabase DB host
$user = "postgres";
$password = "8594"; // Use your actual Supabase DB password
$dbname = "postgres"; // Default database name in Supabase is usually 'postgres'

// CORS Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Enable error reporting for development (Disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 1);

// PostgreSQL connection string
$conn = pg_connect("host=$host dbname=$dbname user=$user password=$password");

// Check the connection
if (!$conn) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed: ' . pg_last_error()
    ]);
    exit();
}

// Uncomment below for debugging ONLY in development
// echo "Connected successfully to the database!";
?>
