const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://skyfleet_user:skyfleet_pass@localhost:5432/skyfleet',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(express.json()); // Use this only once
app.use(express.static('public'));

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Initialize Database Schema
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        name VARCHAR(255),
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        crew_type VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Fleet table
    await client.query(`
      CREATE TABLE IF NOT EXISTS fleet (
        id SERIAL PRIMARY KEY,
        tail_number VARCHAR(50) UNIQUE NOT NULL,
        model VARCHAR(100) NOT NULL,
        capacity INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // CORRECTED Flights table schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS flights (
        id SERIAL PRIMARY KEY,
        flight_number VARCHAR(50) UNIQUE NOT NULL,
        from_airport VARCHAR(10) NOT NULL,
        to_airport VARCHAR(10) NOT NULL,
        departure_at TIMESTAMP WITH TIME ZONE NOT NULL,
        arrival_at TIMESTAMP WITH TIME ZONE NOT NULL,
        assigned_aircraft VARCHAR(50),
        status VARCHAR(50) DEFAULT 'Scheduled',
        crew_manifest JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Bookings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        passenger_name VARCHAR(255),
        passenger_email VARCHAR(255),
        flight_number VARCHAR(50),
        booking_date DATE,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Invites table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invites (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes with CORRECTED column name
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_flights_departure_at ON flights(departure_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_flights_number ON flights(flight_number)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_invites_status ON invites(status)');

    // Create default admin user if not exists
    const adminCheck = await client.query('SELECT * FROM users WHERE email = $1', ['admin@skyfleet.com']);
    if (adminCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query(
        'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4)',
        ['admin@skyfleet.com', hashedPassword, 'Administrator', 'admin']
      );
      console.log('Default admin user created: admin@skyfleet.com / admin123');
    }

    const crewCheck = await client.query('SELECT * FROM users WHERE email = $1', ['crew@skyfleet.com']);
    if (crewCheck.rows.length === 0) {
        const hashedPassword = await bcrypt.hash('crew123', 10);
        await client.query(
            'INSERT INTO users (email, password, name, role, crew_type) VALUES ($1, $2, $3, $4, $5)',
            ['crew@skyfleet.com', hashedPassword, 'John Crew', 'crew', 'Pilot']
        );
        console.log('Default crew user created: crew@skyfleet.com / crew123');
    }

    const passCheck = await client.query('SELECT * FROM users WHERE email = $1', ['pass@skyfleet.com']);
    if (passCheck.rows.length === 0) {
        const hashedPassword = await bcrypt.hash('pass123', 10);
        await client.query(
            'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4)',
            ['pass@skyfleet.com', hashedPassword, 'Jane Passenger', 'passenger']
        );
        console.log('Default passenger user created: pass@skyfleet.com / pass123');
    }

    await client.query('COMMIT');
    console.log('Database initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
}

// ============ AUTH ROUTES ============
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, role FROM users WHERE id = $1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ STATS ROUTES ============
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const flightsCount = await pool.query('SELECT COUNT(*) FROM flights');
    const fleetCount = await pool.query('SELECT COUNT(*) FROM fleet');
    const crewCount = await pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['crew']);
    const invitesCount = await pool.query('SELECT COUNT(*) FROM invites WHERE status = $1', ['pending']);
    res.json({
      totalFlights: parseInt(flightsCount.rows[0].count),
      totalFleet: parseInt(fleetCount.rows[0].count),
      totalCrew: parseInt(crewCount.rows[0].count),
      totalInvites: parseInt(invitesCount.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ FLEET ROUTES (Unchanged) ============
// These routes are correct and do not need changes.
app.get('/api/fleet', authenticateToken, async (req, res) => { try { const result = await pool.query('SELECT * FROM fleet ORDER BY tail_number'); res.json(result.rows); } catch (err) { res.status(500).json({ error: err.message }); } });
app.get('/api/fleet/:id', authenticateToken, async (req, res) => { try { const result = await pool.query('SELECT * FROM fleet WHERE id = $1', [req.params.id]); if (result.rows.length === 0) return res.status(404).json({ error: 'Aircraft not found' }); res.json(result.rows[0]); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/fleet', authenticateToken, async (req, res) => { try { const { tailNumber, model, capacity, status } = req.body; const result = await pool.query('INSERT INTO fleet (tail_number, model, capacity, status) VALUES ($1, $2, $3, $4) RETURNING *', [tailNumber, model, capacity, status || 'Active']); res.json(result.rows[0]); } catch (err) { res.status(500).json({ error: err.message }); } });
app.put('/api/fleet/:id', authenticateToken, async (req, res) => { try { const { tailNumber, model, capacity, status } = req.body; const result = await pool.query('UPDATE fleet SET tail_number = $1, model = $2, capacity = $3, status = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *', [tailNumber, model, capacity, status, req.params.id]); if (result.rows.length === 0) return res.status(404).json({ error: 'Aircraft not found' }); res.json(result.rows[0]); } catch (err) { res.status(500).json({ error: err.message }); } });
app.delete('/api/fleet/:id', authenticateToken, async (req, res) => { try { await pool.query('DELETE FROM fleet WHERE id = $1', [req.params.id]); res.json({ message: 'Aircraft deleted successfully' }); } catch (err) { res.status(500).json({ error: err.message }); } });

// ============ FLIGHTS ROUTES ============

// CORRECTED GET /api/flights route
app.get('/api/flights', authenticateToken, async (req, res) => {
    try {
        // 1. Get all possible search query parameters from the URL
        const { date, from, to, limit } = req.query;

        let query = 'SELECT * FROM flights';
        const conditions = [];
        const params = [];
        
        // 2. Dynamically build the WHERE clause based on what was provided
        if (from) {
            conditions.push(`from_airport ILIKE $${params.length + 1}`);
            params.push(from.trim());
        }
        if (to) {
            conditions.push(`to_airport ILIKE $${params.length + 1}`);
            params.push(to.trim());
        }
        if (date) {
            conditions.push(`departure_at::date = $${params.length + 1}`);
            params.push(date);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        // 3. Order results chronologically and apply a limit if provided
        query += ' ORDER BY departure_at ASC'; // ASC shows earliest flights first

        if (limit) {
            query += ` LIMIT $${params.length + 1}`;
            params.push(limit);
        }

        const result = await pool.query(query, params);
        res.json(result.rows);

    } catch (err) {
        console.error('Error searching flights:', err);
        res.status(500).json({ error: 'Failed to perform flight search.' });
    }
});

app.get('/api/flights/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM flights WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Flight not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CORRECTED POST /api/flights route
app.post('/api/flights', authenticateToken, async (req, res) => {
  try {
    const { flightNumber, from, to, departure_at, arrival_at, assignedAircraft, status } = req.body;
    const result = await pool.query(
      `INSERT INTO flights (flight_number, from_airport, to_airport, departure_at, arrival_at, assigned_aircraft, status, crew_manifest) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [flightNumber, from, to, departure_at, arrival_at, assignedAircraft, status || 'Scheduled', '{}']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating flight:', err);
    res.status(500).json({ error: err.message });
  }
});

// CORRECTED PUT /api/flights/:id route
app.put('/api/flights/:id', authenticateToken, async (req, res) => {
  try {
    const { flightNumber, from, to, departure_at, arrival_at, assignedAircraft, status } = req.body;
    const result = await pool.query(
      `UPDATE flights SET flight_number = $1, from_airport = $2, to_airport = $3, departure_at = $4, 
       arrival_at = $5, assigned_aircraft = $6, status = $7, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $8 RETURNING *`,
      [flightNumber, from, to, departure_at, arrival_at, assignedAircraft, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Flight not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating flight:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/flights/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM flights WHERE id = $1', [req.params.id]);
    res.json({ message: 'Flight deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/flights/:id/crew', authenticateToken, async (req, res) => {
  try {
    const { crewManifest } = req.body;
    const result = await pool.query(
      'UPDATE flights SET crew_manifest = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [JSON.stringify(crewManifest), req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Flight not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ CREW/USERS ROUTES (Unchanged) ============
// In server.js

app.get('/api/crew', authenticateToken, async (req, res) => {
  const { flightId } = req.query;

  if (!flightId) {
    // Fallback for just getting all crew without checks
    const allCrew = await pool.query("SELECT id, email, name, role, crew_type, status FROM users WHERE role = 'crew' ORDER BY name");
    return res.json(allCrew.rows);
  }

  try {
    // 1. Get details for the flight we are trying to staff
    const flightResult = await pool.query('SELECT f.id, f.departure_at, f.from_airport, fl.model FROM flights f JOIN fleet fl ON f.assigned_aircraft = fl.tail_number WHERE f.id = $1', [flightId]);
    if (flightResult.rows.length === 0) {
      return res.status(404).json({ error: 'Flight not found' });
    }
    const currentFlight = flightResult.rows[0];
    const requiredAircraftModel = currentFlight.model;

    // 2. Get all crew members
    const crewResult = await pool.query("SELECT * FROM users WHERE role = 'crew'");
    const allCrew = crewResult.rows;

    const availableCrew = [];

    // 3. For each crew member, find their last flight and check rules
    for (const crewMember of allCrew) {
      const lastFlightResult = await pool.query(
        `SELECT arrival_at, to_airport FROM flights 
         WHERE (crew_manifest->'pilot'->>'email' = $1 OR crew_manifest->'copilot'->>'email' = $1 OR crew_manifest->'cabinCrewManager'->>'email' = $1)
         AND arrival_at < $2 
         ORDER BY arrival_at DESC LIMIT 1`,
        [crewMember.email, currentFlight.departure_at]
      );
      
      const lastFlight = lastFlightResult.rows[0];
      let availability = { ...crewMember, available: true, reason: 'Available' };

      // Rule Check 1: Qualification
      if (!crewMember.qualifications?.aircraft_types?.includes(requiredAircraftModel)) {
        availability.available = false;
        availability.reason = `Not qualified for ${requiredAircraftModel}`;
      }

      if (lastFlight) {
        // Rule Check 2: Minimum Rest Period (e.g., 10 hours)
        const restHours = (new Date(currentFlight.departure_at) - new Date(lastFlight.arrival_at)) / (1000 * 60 * 60);
        if (restHours < 10) {
          availability.available = false;
          availability.reason = `Insufficient rest (${Math.floor(restHours)}h)`;
        }

        // Rule Check 3: Layover Location
        if (lastFlight.to_airport !== currentFlight.from_airport) {
          availability.available = false;
          availability.reason = `Wrong location (at ${lastFlight.to_airport})`;
        }
      }
      
      availableCrew.push(availability);
    }

    res.json(availableCrew);

  } catch (err) {
    console.error('Error fetching available crew:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/crew', authenticateToken, async (req, res) => { try { const { name, email, crewType, status } = req.body; const result = await pool.query('INSERT INTO users (name, email, crew_type, status, role) VALUES ($1, $2, $3, $4, $5) RETURNING *', [name, email, crewType, status || 'Active', 'crew']); res.json(result.rows[0]); } catch (err) { res.status(500).json({ error: err.message }); } });
app.put('/api/crew/:id', authenticateToken, async (req, res) => { try { const { name, crewType, status } = req.body; const result = await pool.query('UPDATE users SET name = $1, crew_type = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND role = \'crew\' RETURNING *', [name, crewType, status, req.params.id]); if (result.rows.length === 0) return res.status(404).json({ error: 'Crew member not found' }); res.json(result.rows[0]); } catch (err) { res.status(500).json({ error: err.message }); } });
app.delete('/api/crew/:id', authenticateToken, async (req, res) => { try { await pool.query('DELETE FROM users WHERE id = $1 AND role = \'crew\'', [req.params.id]); res.json({ message: 'Crew member deleted successfully' }); } catch (err) { res.status(500).json({ error: err.message }); } });



// ============ BOOKINGS & INVITES & ANALYTICS ROUTES (Unchanged) ============
// These routes are correct and do not need changes.
// ADD THIS NEW BLOCK
app.get('/api/bookings', authenticateToken, async (req, res) => {
    try {
        const { role, email } = req.user;
        
        let queryText;
        let queryParams = [];

        // This query JOINS bookings and flights to get all details in one go
        const baseQuery = `
            SELECT
                b.id, b.passenger_name, b.passenger_email, b.booking_date, b.status,
                f.flight_number, f.from_airport, f.to_airport, f.departure_at
            FROM bookings b
            LEFT JOIN flights f ON b.flight_number = f.flight_number`;

        if (role === 'admin') {
            // Admin gets all bookings
            queryText = `${baseQuery} ORDER BY b.booking_date DESC`;
        } else {
            // Passengers only get their own bookings
            queryText = `${baseQuery} WHERE b.passenger_email = $1 ORDER BY b.booking_date DESC`;
            queryParams.push(email);
        }

        const { rows } = await pool.query(queryText, queryParams);
        res.json(rows);

    } catch (err) {
        console.error('Error fetching bookings:', err);
        res.status(500).json({ error: 'Failed to fetch bookings.' });
    }
});
app.get('/api/bookings/:id', authenticateToken, async (req, res) => { try { const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]); if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' }); res.json(result.rows[0]); } catch (err) { res.status(500).json({ error: err.message }); } });
app.delete('/api/bookings/:id', authenticateToken, async (req, res) => { try { await pool.query('DELETE FROM bookings WHERE id = $1', [req.params.id]); res.json({ message: 'Booking deleted successfully' }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.get('/api/invites', authenticateToken, async (req, res) => { try { const result = await pool.query('SELECT * FROM invites ORDER BY sent_at DESC'); res.json(result.rows); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/invites', authenticateToken, async (req, res) => { try { const { email, role } = req.body; const result = await pool.query('INSERT INTO invites (email, role, status) VALUES ($1, $2, $3) RETURNING *', [email, role, 'pending']); res.json(result.rows[0]); } catch (err) { res.status(500).json({ error: err.message }); } });
app.put('/api/invites/:id/resend', authenticateToken, async (req, res) => { try { const result = await pool.query('UPDATE invites SET sent_at = CURRENT_TIMESTAMP, status = $1 WHERE id = $2 RETURNING *', ['pending', req.params.id]); if (result.rows.length === 0) return res.status(404).json({ error: 'Invite not found' }); res.json(result.rows[0]); } catch (err) { res.status(500).json({ error: err.message }); } });
app.delete('/api/invites/:id', authenticateToken, async (req, res) => { try { await pool.query('DELETE FROM invites WHERE id = $1', [req.params.id]); res.json({ message: 'Invite revoked successfully' }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.get('/api/analytics/flights', authenticateToken, async (req, res) => { try { const result = await pool.query('SELECT status, COUNT(*) as count FROM flights GROUP BY status'); res.json(result.rows); } catch (err) { res.status(500).json({ error: err.message }); } });
app.get('/api/analytics/fleet', authenticateToken, async (req, res) => { try { const result = await pool.query('SELECT status, COUNT(*) as count FROM fleet GROUP BY status'); res.json(result.rows); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/bookings', authenticateToken, async (req, res) => {
    try {
        const { flightNumber } = req.body;
        // req.user is available from the authenticateToken middleware
        const { name, email } = req.user; 

        const result = await pool.query(
            `INSERT INTO bookings (passenger_name, passenger_email, flight_number, booking_date, status)
             VALUES ($1, $2, $3, NOW(), 'confirmed') RETURNING *`,
            [name, email, flightNumber]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating booking:', err);
        res.status(500).json({ error: 'Failed to create booking.' });
    }
});
// Start server
async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();