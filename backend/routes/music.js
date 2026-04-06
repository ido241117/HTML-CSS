/**
 * Music Routes
 * API endpoints cho Music player
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const mm = require('music-metadata');
const sharp = require('sharp');
const { getMusicDir, PICTURE_DIR, ALT_PICTURE_DIR } = require('../utils/helpers');

// ========== HELPER FUNCTIONS ==========
// (No longer using loadNotes/saveNotes from file system)

// ========== API ENDPOINTS ==========

// Lấy danh sách file nhạc (Từ MongoDB)
router.get('/songs', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 0;
        const db = req.app.locals.db;

        if (!db) {
            return res.status(500).json({ error: 'Database not connected' });
        }

        const query = {};
        // Có thể thêm filter search ở đây nếu cần

        const total = await db.collection('songs').countDocuments(query);
        let cursor = db.collection('songs').find(query).sort({ datemodified: -1 }); // Mới nhất lên đầu

        if (limit > 0) {
            cursor = cursor.skip((page - 1) * limit).limit(limit);
        }

        const songs = await cursor.toArray();

        // Map lại để đảm bảo cấu trúc trả về giống cũ, đặc biệt là URL
        // URL vẫn trỏ về local file để player chạy được
        const mappedSongs = songs.map(s => ({
            name: s.name,
            url: s.url || `/music/${encodeURIComponent(s.name)}`, // Fallback nếu chưa có url trong db
            datemodified: s.datemodified,
            duration: s.duration,
            size: s.size,
            note: s.note || '',
            cover: s.cover || ''
        }));

        if (limit > 0) {
            res.json({
                songs: mappedSongs,
                total: total,
                page: page,
                limit: limit,
                totalPages: Math.ceil(total / limit)
            });
        } else {
            res.json(mappedSongs);
        }
    } catch (err) {
        console.error('Error fetching songs:', err);
        res.status(500).json({ error: 'Lỗi khi lấy danh sách nhạc' });
    }
});

// Lấy ghi chú và cover của bài nhạc (Từ MongoDB)
router.get('/notes/:songName', async (req, res) => {
    try {
        const songName = decodeURIComponent(req.params.songName);
        const db = req.app.locals.db;

        const song = await db.collection('songs').findOne({ name: songName });

        if (song) {
            res.json({ note: song.note || '', cover: song.cover || '' });
        } else {
            res.json({ note: '', cover: '' });
        }
    } catch (err) {
        console.error('Error fetching note:', err);
        res.status(500).json({ error: 'Lỗi khi lấy ghi chú' });
    }
});

// Lưu ghi chú và cover cho bài nhạc (Vào MongoDB)
router.post('/notes/:songName', async (req, res) => {
    try {
        const songName = decodeURIComponent(req.params.songName);
        const db = req.app.locals.db;
        const updateData = {};

        if ('note' in req.body) updateData.note = req.body.note;
        if ('cover' in req.body) updateData.cover = req.body.cover;

        // Upsert: Nếu bài hát chưa có trong DB (ví dụ mới copy vào mà chưa chạy scan), 
        // thì tạo mới record với tên bài hát
        await db.collection('songs').updateOne(
            { name: songName },
            { $set: updateData },
            { upsert: true }
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Error saving note:', err);
        res.status(500).json({ error: 'Lỗi khi lưu ghi chú' });
    }
});

// Rescan Library (Sync from Local to MongoDB)
router.post('/rescan', async (req, res) => {
    try {
        const musicDir = getMusicDir();
        const db = req.app.locals.db;

        if (!db) return res.status(500).json({ error: 'Database not connected' });
        if (!fs.existsSync(musicDir)) return res.status(500).json({ error: 'Music directory not found' });

        const files = fs.readdirSync(musicDir);
        const musicFiles = files.filter(f => /\.(mp3|wav|flac|m4a|ogg)$/i.test(f));

        let count = 0;
        for (const fileName of musicFiles) {
            const filePath = path.join(musicDir, fileName);
            let stats = fs.statSync(filePath);

            // Get duration if possible
            let duration = 0;
            try {
                const metadata = await mm.parseFile(filePath);
                duration = metadata.format.duration || 0;
            } catch (e) { }

            await db.collection('songs').updateOne(
                { name: fileName },
                {
                    $set: {
                        name: fileName,
                        url: `/music/${encodeURIComponent(fileName)}`,
                        localPath: filePath,
                        size: stats.size,
                        datemodified: stats.mtime.toISOString(),
                        duration: duration
                    },
                    $setOnInsert: { note: '', cover: '' } // Only set if inserting new
                },
                { upsert: true }
            );
            count++;
        }

        // --- NEW: Remove stale entries (files that no longer exist) ---
        const deleteResult = await db.collection('songs').deleteMany({
            name: { $nin: musicFiles }
        });
        const deletedCount = deleteResult.deletedCount;

        res.json({
            success: true,
            message: `Đã quét: ${count} bài hiện có.\nĐã xóa: ${deletedCount} bài cũ/không tồn tại.`
        });
    } catch (err) {
        console.error('Rescan error:', err);
        res.status(500).json({ error: 'Lỗi khi quét thư mục: ' + err.message });
    }
});

// Get Thumbnail (Generate if not exists)
router.get('/thumbnail/:filename', async (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const altIconPath = path.join(PICTURE_DIR, 'index_icon', filename);
    const originalPath = fs.existsSync(altIconPath) ? altIconPath : path.join(PICTURE_DIR, filename);
    const thumbPath = path.join(ALT_PICTURE_DIR, filename);

    // 1. Check if thumbnail exists
    if (fs.existsSync(thumbPath)) {
        return res.sendFile(thumbPath);
    }

    // 2. Check if original exists
    if (!fs.existsSync(originalPath)) {
        // Return default image or 404
        return res.redirect('/picture/default.png'); // Assuming default.png is in picture folder and served statically
    }

    // 3. Generate Thumbnail
    try {
        await sharp(originalPath)
            .resize(200, 200, { fit: 'cover' }) // Resize to 200x200
            .toFile(thumbPath);

        // 4. Serve the new thumbnail
        res.sendFile(thumbPath);
    } catch (err) {
        console.error('Thumbnail generation error:', err);
        // Fallback to original if resize fails
        res.sendFile(originalPath);
    }
});

// Static file serving for music (will be set up in main server.js)
// router.use('/music', cors(), express.static(MUSIC_DIR));

module.exports = router;
