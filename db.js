const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.pezdqmellmcmewcvssbv:8594@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: {
    rejectUnauthorized: false,
  },
});

const db = {
  getAllRooms: async () => {
    const result = await pool.query('SELECT * FROM rooms');
    return result.rows;
  },
  getRoomById: async (room_id) => {
    const result = await pool.query('SELECT * FROM rooms WHERE room_id = $1', [room_id]);
    return result.rows[0];
  },
  createRoom: async ({ room_id, room_name, admin_name, participants }) => {
    await pool.query(
      'INSERT INTO rooms (room_id, room_name, admin_name, participants) VALUES ($1, $2, $3, $4)',
      [room_id, room_name, admin_name, JSON.stringify(participants)]
    );
  },
  updateParticipants: async (room_id, participants) => {
    await pool.query('UPDATE rooms SET participants = $1 WHERE room_id = $2', [participants, room_id]);
  },
  deleteRoom: async (room_id) => {
    await pool.query('DELETE FROM rooms WHERE room_id = $1', [room_id]);
  },
};

module.exports = db;
