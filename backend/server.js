/**
 * Personal Hub - Backend Server
 * Entry point - imports and mounts all route modules
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import helpers for static file paths
const { getMusicDir, PICTURE_DIR, DOWNLOAD_DIR, TEMP_DIR, YOUTUBE_API_KEY, MONGO_URI, DB_NAME } = require('./utils/helpers');

// Import MongoDB
const { MongoClient } = require('mongodb');

// Import routes
const musicRoutes = require('./routes/music');
const diaryRoutes = require('./routes/diary');
const bookRoutes = require('./routes/book');
const youtubeRoutes = require('./routes/youtube');
const downloadRoutes = require('./routes/download');
const calendarRoutes = require('./routes/calendar');
const configRoutes = require('./routes/config');
const financeRoutes = require('./routes/finance');
const movieRoutes = require('./routes/movie');

// ========== APP SETUP ==========
const app = express();
const PORT = 3001;

// Warnings for missing API keys
if (!YOUTUBE_API_KEY) {
  console.error('WARNING: YOUTUBE_API_KEY is not set in .env file!');
}

// ========== MIDDLEWARE ==========

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url} from ${req.ip}`);
  next();
});

// ========== STATIC FILES ==========

// Serve picture directory
app.use('/picture', cors(), express.static(PICTURE_DIR));

// Serve download directory  
app.use('/dowload', cors(), express.static(DOWNLOAD_DIR));

// Serve temp directory
app.use('/temp', cors(), express.static(TEMP_DIR));

// Serve music directory (dynamic based on config)
app.use('/music', cors(), (req, res, next) => {
  express.static(getMusicDir())(req, res, next);
});

// Serve frontend
app.use('/code/frontend', express.static(path.join(__dirname, '../frontend')));

// ========== API ROUTES ==========

// Music APIs
app.use('/api', musicRoutes);

// Diary APIs
app.use('/api', diaryRoutes);

// Book APIs
app.use('/api', bookRoutes);

// YouTube Feed APIs
app.use('/api/youtube', youtubeRoutes);

// Download APIs
app.use('/api', downloadRoutes);

// Calendar/Events APIs
app.use('/api', calendarRoutes);

// Config/Settings APIs
app.use('/api', configRoutes);

// Finance APIs
app.use('/api', financeRoutes);

// Movie APIs
app.use('/api', movieRoutes);

// ========== START SERVER ==========

let db;

async function startServer() {
  try {
    // Connect to MongoDB
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log(`✓ Connected to MongoDB: ${DB_NAME}`);

    // Make db available to routes via app.locals
    app.locals.db = db;

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`========================================`);
      console.log(`Personal Hub Backend - Modular Edition`);
      console.log(`Local: http://localhost:${PORT}`);
      console.log(`Music Directory: ${getMusicDir()}`);
      console.log(`========================================`);
      console.log(`Routes loaded:`);
      console.log(`  - Music: /api/songs, /api/notes`);
      console.log(`  - Diary: /api/diary-posts, /api/diary-profile`);
      console.log(`  - Book: /api/books`);
      console.log(`  - YouTube: /api/youtube/collections`);
      console.log(`  - Download: /api/download-youtube`);
      console.log(`  - Calendar: /api/events, /api/tasks`);
      console.log(`  - Config: /api/config, /api/shortcuts`);
      console.log(`  - Movie: /api/movies`);
      console.log(`========================================`);
    });
  } catch (error) {
    console.error('FAILED to connect to MongoDB:', error);
    process.exit(1);
  }
}

startServer();
