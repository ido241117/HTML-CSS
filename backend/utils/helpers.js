/**
 * Shared Helpers & Constants
 * Các đường dẫn và hàm tiện ích dùng chung
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// ========== DIRECTORY PATHS ==========
const NOTES_FILE = path.join(__dirname, '../notes.json');
const SHORTCUTS_FILE = path.join(__dirname, '../shortcuts.json');
const TASKS_FILE = path.join(__dirname, '../tasks.json');
const EVENTS_FILE = path.join(__dirname, '../events.json');
const DIARY_FILE = path.join(__dirname, '../diary.json');
const DIARY_PROFILE_FILE = path.join(__dirname, '../diary-profile.json');
const BOOK_METADATA_FILE = path.join(__dirname, '../book-metadata.json');
const MOVIES_FILE = path.join(__dirname, '../movies.json');

// Directories
const MUSIC_DIR = 'D:\\Project M\\RAW';
const WRITE_DIR = path.join(__dirname, '../../../Write');
const PICTURE_DIR = path.join(__dirname, '../../../picture');
const DOWNLOAD_DIR = path.join(__dirname, '../../../dowload');
const BOOK_DIR = path.join(__dirname, '../../../book');
const TEMP_DIR = 'Z:\\Tempfile';
const ALT_PICTURE_DIR = path.join(__dirname, '../../../picture/alt');
const ALT_BOOK_DIR = path.join(__dirname, '../../../picture/alt/book');
const ALT_MOVIE_DIR = path.join(__dirname, '../../../picture/alt/movie');
const YTDLP_PATH = path.join(__dirname, '../../../seal/yt-dlp.exe');
const FFMPEG_PATH = path.join(__dirname, '../../../seal/ffmpeg.exe');
const COLLECTIONS_DIR = path.join(__dirname, '../youtube-collections');

// ========== API KEYS ==========
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// ========== GETTER FOR MUSIC_DIR ==========
function getMusicDir() {
    return MUSIC_DIR;
}

// ========== OPEN FILE/FOLDER ==========
function openWithDefaultApp(filePath, callback) {
    const command = process.platform === 'win32'
        ? `start "" "${filePath}"`
        : process.platform === 'darwin'
            ? `open "${filePath}"`
            : `xdg-open "${filePath}"`;

    exec(command, callback);
}

function openFolder(folderPath, callback) {
    const command = process.platform === 'win32'
        ? `explorer "${folderPath}"`
        : process.platform === 'darwin'
            ? `open "${folderPath}"`
            : `xdg-open "${folderPath}"`;

    exec(command, callback);
}

// Ensure directories exist
if (!fs.existsSync(COLLECTIONS_DIR)) {
    fs.mkdirSync(COLLECTIONS_DIR, { recursive: true });
}
if (!fs.existsSync(ALT_PICTURE_DIR)) {
    fs.mkdirSync(ALT_PICTURE_DIR, { recursive: true });
}
if (!fs.existsSync(ALT_BOOK_DIR)) {
    fs.mkdirSync(ALT_BOOK_DIR, { recursive: true });
}
if (!fs.existsSync(ALT_MOVIE_DIR)) {
    fs.mkdirSync(ALT_MOVIE_DIR, { recursive: true });
}

module.exports = {
    // Paths
    NOTES_FILE,
    SHORTCUTS_FILE,
    TASKS_FILE,
    EVENTS_FILE,
    DIARY_FILE,
    DIARY_PROFILE_FILE,
    BOOK_METADATA_FILE,
    WRITE_DIR,
    PICTURE_DIR,
    ALT_PICTURE_DIR,
    ALT_BOOK_DIR,
    ALT_MOVIE_DIR,
    DOWNLOAD_DIR,
    BOOK_DIR,
    TEMP_DIR,
    YTDLP_PATH,
    FFMPEG_PATH,
    COLLECTIONS_DIR,
    MOVIES_FILE,

    // API Keys
    YOUTUBE_API_KEY,

    // Functions
    getMusicDir,
    openWithDefaultApp,
    openFolder,

    // MongoDB
    MONGO_URI: 'mongodb://localhost:27017',
    DB_NAME: 'MusicProject'
};
