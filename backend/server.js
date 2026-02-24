const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL Pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'roximity_db',
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected:', res.rows[0]);
  }
});

// Middleware: Verify JWT
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  const bearerToken = token.split(' ')[1];
  jwt.verify(bearerToken, process.env.JWT_SECRET || 'your_secret_key', (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  });
};

// ==================== USER ROUTES ====================

// Register User
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name || !role) {
    return res.status(400).json({ message: 'All fields required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
      [email, hashedPassword, name, role]
    );
    res.status(201).json({ message: 'User registered', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'your_secret_key',
      { expiresIn: '24h' }
    );

    res.json({ message: 'Login successful', token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// ==================== SESSION ROUTES ====================

// Create Session (Faculty only)
app.post('/api/sessions', verifyToken, async (req, res) => {
  if (req.userRole !== 'faculty') {
    return res.status(403).json({ message: 'Only faculty can create sessions' });
  }

  const { course_id, start_time, end_time, required_presence_percentage } = req.body;

  if (!course_id || !start_time || !end_time || !required_presence_percentage) {
    return res.status(400).json({ message: 'All fields required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO sessions (faculty_id, course_id, start_time, end_time, required_presence_percentage) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.userId, course_id, start_time, end_time, required_presence_percentage]
    );
    res.status(201).json({ message: 'Session created', session: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Session creation failed', error: error.message });
  }
});

// Get All Sessions
app.get('/api/sessions', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sessions ORDER BY start_time DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sessions', error: error.message });
  }
});

// Get Session by ID
app.get('/api/sessions/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch session', error: error.message });
  }
});

// Update Session (Faculty only)
app.put('/api/sessions/:id', verifyToken, async (req, res) => {
  if (req.userRole !== 'faculty') {
    return res.status(403).json({ message: 'Only faculty can update sessions' });
  }

  const { id } = req.params;
  const { course_id, start_time, end_time, required_presence_percentage } = req.body;

  try {
    const result = await pool.query(
      'UPDATE sessions SET course_id = $1, start_time = $2, end_time = $3, required_presence_percentage = $4 WHERE id = $5 RETURNING *',
      [course_id, start_time, end_time, required_presence_percentage, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }
    res.json({ message: 'Session updated', session: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update session', error: error.message });
  }
});

// ==================== PRESENCE LOGS ROUTES ====================

// Log Presence (BLE Observer)
app.post('/api/presence-logs', async (req, res) => {
  const { session_id, device_identifier, timestamp, rssi } = req.body;

  if (!session_id || !device_identifier || !timestamp) {
    return res.status(400).json({ message: 'All fields required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO presence_logs (session_id, device_identifier, timestamp, rssi) VALUES ($1, $2, $3, $4) RETURNING *',
      [session_id, device_identifier, timestamp, rssi || -50]
    );
    res.status(201).json({ message: 'Presence logged', log: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Failed to log presence', error: error.message });
  }
});

// Get Presence Logs for Session
app.get('/api/presence-logs/:session_id', verifyToken, async (req, res) => {
  const { session_id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM presence_logs WHERE session_id = $1 ORDER BY timestamp ASC',
      [session_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch presence logs', error: error.message });
  }
});

// ==================== ATTENDANCE COMPUTATION ROUTES ====================

// Compute Attendance for Session
app.post('/api/attendance/compute/:session_id', verifyToken, async (req, res) => {
  if (req.userRole !== 'faculty') {
    return res.status(403).json({ message: 'Only faculty can compute attendance' });
  }

  const { session_id } = req.params;

  try {
    // Fetch session details
    const sessionResult = await pool.query('SELECT * FROM sessions WHERE id = $1', [session_id]);
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const session = sessionResult.rows[0];
    const sessionDuration = new Date(session.end_time) - new Date(session.start_time);
    const requiredDuration = (sessionDuration * session.required_presence_percentage) / 100;

    // Fetch all presence logs for this session
    const logsResult = await pool.query(
      'SELECT * FROM presence_logs WHERE session_id = $1 ORDER BY device_identifier, timestamp ASC',
      [session_id]
    );

    const logs = logsResult.rows;
    const devicePresence = {};

    // Group logs by device and calculate cumulative presence
    logs.forEach(log => {
      if (!devicePresence[log.device_identifier]) {
        devicePresence[log.device_identifier] = [];
      }
      devicePresence[log.device_identifier].push(new Date(log.timestamp));
    });

    // Merge timestamps into time blocks (allow 5-minute gaps)
    const GAP_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    const attendanceRecords = [];

    for (const [deviceId, timestamps] of Object.entries(devicePresence)) {
      let cumulativeDuration = 0;
      let blockStart = timestamps[0];

      for (let i = 1; i < timestamps.length; i++) {
        const gap = timestamps[i] - timestamps[i - 1];

        if (gap > GAP_THRESHOLD) {
          // End current block
          cumulativeDuration += timestamps[i - 1] - blockStart;
          blockStart = timestamps[i];
        }
      }

      // Add final block
      cumulativeDuration += timestamps[timestamps.length - 1] - blockStart;

      const isPresent = cumulativeDuration >= requiredDuration;
      const status = isPresent ? 'Present' : 'Absent';

      attendanceRecords.push({
        session_id,
        device_identifier: deviceId,
        cumulative_duration_ms: cumulativeDuration,
        required_duration_ms: requiredDuration,
        status,
        computed_at: new Date()
      });
    }

    // Store attendance records
    for (const record of attendanceRecords) {
      await pool.query(
        'INSERT INTO attendance_records (session_id, device_identifier, cumulative_duration_ms, required_duration_ms, status) VALUES ($1, $2, $3, $4, $5)',
        [record.session_id, record.device_identifier, record.cumulative_duration_ms, record.required_duration_ms, record.status]
      );
    }

    res.json({ message: 'Attendance computed', records: attendanceRecords });
  } catch (error) {
    res.status(500).json({ message: 'Failed to compute attendance', error: error.message });
  }
});

// Get Attendance Records for Session
app.get('/api/attendance/:session_id', verifyToken, async (req, res) => {
  const { session_id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM attendance_records WHERE session_id = $1 ORDER BY status DESC',
      [session_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch attendance records', error: error.message });
  }
});

// ==================== STUDENT SESSION ROUTES ====================

// Register Student to Session
app.post('/api/student-sessions', verifyToken, async (req, res) => {
  if (req.userRole !== 'student') {
    return res.status(403).json({ message: 'Only students can register for sessions' });
  }

  const { session_id, temporary_ble_identifier } = req.body;

  if (!session_id || !temporary_ble_identifier) {
    return res.status(400).json({ message: 'Session ID and BLE identifier required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO student_sessions (student_id, session_id, temporary_ble_identifier, enrolled_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [req.userId, session_id, temporary_ble_identifier]
    );
    res.status(201).json({ message: 'Student registered to session', enrollment: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Failed to register student', error: error.message });
  }
});

// Get Student's Sessions
app.get('/api/student-sessions', verifyToken, async (req, res) => {
  if (req.userRole !== 'student') {
    return res.status(403).json({ message: 'Only students can view their sessions' });
  }

  try {
    const result = await pool.query(
      'SELECT ss.*, s.course_id, s.start_time, s.end_time FROM student_sessions ss JOIN sessions s ON ss.session_id = s.id WHERE ss.student_id = $1 ORDER BY s.start_time DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch student sessions', error: error.message });
  }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend is running', timestamp: new Date() });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${process.env.DB_NAME || 'roximity_db'}`);
});

module.exports = app;