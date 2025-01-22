const { Pool } = require('pg'); // PostgreSQL library

// PostgreSQL connection setup using connection string
const pool = new Pool({
  connectionString: 'postgresql://postgres.pezdqmellmcmewcvssbv:8594@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: {
    rejectUnauthorized: false // Necessary for Render SSL connection
  }
});

async function joinRoom(req, res) {
  const { room_id, participant_name } = req.body;

  if (!room_id || !participant_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Fetch the room details
    const result = await pool.query(
      'SELECT * FROM rooms WHERE room_id = $1',
      [room_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = result.rows[0];
    const participants = room.participants || []; // JSONB array

    // Check if the participant is already in the room
    if (participants.includes(participant_name)) {
      return res.status(400).json({ error: 'Participant already in the room' });
    }

    // Add the participant
    await pool.query(
      'UPDATE rooms SET participants = participants || $1 WHERE room_id = $2',
      [JSON.stringify(participant_name), room_id]
    );

    res.json({
      message: 'Joined room successfully',
      data: {
        room_name: room.room_name,
        admin_name: room.admin_name,
        participants: [...participants, participant_name], // Return updated participants
      },
    });
  } catch (err) {
    console.error('Error joining room:', err.message);
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
}


module.exports = { joinRoom };
