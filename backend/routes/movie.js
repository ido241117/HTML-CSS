/**
 * Movie Routes
 * API endpoints cho Movie management
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { MOVIES_FILE, WRITE_DIR, PICTURE_DIR, ALT_MOVIE_DIR } = require('../utils/helpers');

// ========== HELPER FUNCTIONS ==========
function loadMovies() {
    try {
        if (fs.existsSync(MOVIES_FILE)) {
            return JSON.parse(fs.readFileSync(MOVIES_FILE, 'utf8'));
        }
    } catch (err) {
        console.error('Error loading movies:', err);
    }
    return [];
}

function saveMovies(movies) {
    try {
        fs.writeFileSync(MOVIES_FILE, JSON.stringify(movies, null, 2));
        return true;
    } catch (err) {
        console.error('Error saving movies:', err);
        return false;
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Đọc nội dung file từ Write folder (tên + miêu tả)
function readMovieContent(contentFile) {
    try {
        const filePath = path.join(WRITE_DIR, contentFile);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            const parts = content.split('---');
            return {
                title: parts[0]?.trim() || 'Không có tên',
                description: parts[1]?.trim() || ''
            };
        }
    } catch (err) {
        console.error('Error reading movie content:', err);
    }
    return { title: 'Không có tên', description: '' };
}

// Ghi nội dung file vào Write folder
function writeMovieContent(contentFile, title, description) {
    try {
        const filePath = path.join(WRITE_DIR, contentFile);
        const content = `${title}\n---\n${description}`;
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    } catch (err) {
        console.error('Error writing movie content:', err);
        return false;
    }
}

// Xóa file content
function deleteMovieContent(contentFile) {
    try {
        const filePath = path.join(WRITE_DIR, contentFile);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return true;
    } catch (err) {
        console.error('Error deleting movie content:', err);
        return false;
    }
}

// ========== API ENDPOINTS ==========

// GET - Lấy danh sách tất cả phim
router.get('/movies', (req, res) => {
    try {
        const movies = loadMovies();

        // Map thêm thông tin title và description từ file
        const moviesWithContent = movies.map(movie => {
            const content = readMovieContent(movie.contentFile);
            return {
                ...movie,
                title: content.title,
                description: content.description,
                coverUrl: movie.coverImage
                    ? `http://localhost:3001/picture/${encodeURIComponent(movie.coverImage)}`
                    : 'http://localhost:3001/picture/default.png'
            };
        });

        res.json({ movies: moviesWithContent });
    } catch (err) {
        console.error('Error getting movies:', err);
        res.status(500).json({ error: 'Không thể tải danh sách phim' });
    }
});

// POST - Thêm phim mới
router.post('/movies', (req, res) => {
    try {
        const { title, description, coverImage, status, schedule } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Thiếu tên phim' });
        }

        const movies = loadMovies();
        const id = generateId();
        const contentFile = `movie-${id}.txt`;

        // Ghi nội dung vào file
        if (!writeMovieContent(contentFile, title, description || '')) {
            return res.status(500).json({ error: 'Không thể lưu nội dung phim' });
        }

        const newMovie = {
            id,
            status: status || 'want_to_watch',
            coverImage: coverImage || '',
            contentFile,
            schedule: schedule || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        movies.push(newMovie);

        if (saveMovies(movies)) {
            const content = readMovieContent(contentFile);
            res.json({
                success: true,
                movie: {
                    ...newMovie,
                    title: content.title,
                    description: content.description,
                    coverUrl: newMovie.coverImage
                        ? `http://localhost:3001/picture/${encodeURIComponent(newMovie.coverImage)}`
                        : 'http://localhost:3001/picture/default.png'
                }
            });
        } else {
            res.status(500).json({ error: 'Không thể lưu phim' });
        }
    } catch (err) {
        console.error('Error creating movie:', err);
        res.status(500).json({ error: 'Lỗi khi thêm phim' });
    }
});

// PUT - Cập nhật thông tin phim
router.put('/movies/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, coverImage, status, schedule } = req.body;

        const movies = loadMovies();
        const movieIndex = movies.findIndex(m => m.id === id);

        if (movieIndex === -1) {
            return res.status(404).json({ error: 'Không tìm thấy phim' });
        }

        const movie = movies[movieIndex];

        // Cập nhật nội dung file nếu có thay đổi
        if (title !== undefined || description !== undefined) {
            const currentContent = readMovieContent(movie.contentFile);
            const newTitle = title !== undefined ? title : currentContent.title;
            const newDescription = description !== undefined ? description : currentContent.description;

            if (!writeMovieContent(movie.contentFile, newTitle, newDescription)) {
                return res.status(500).json({ error: 'Không thể cập nhật nội dung phim' });
            }
        }

        // Cập nhật metadata
        if (coverImage !== undefined) movie.coverImage = coverImage;
        if (status !== undefined) movie.status = status;
        if (schedule !== undefined) movie.schedule = schedule;
        movie.updatedAt = new Date().toISOString();

        movies[movieIndex] = movie;

        if (saveMovies(movies)) {
            const content = readMovieContent(movie.contentFile);
            res.json({
                success: true,
                movie: {
                    ...movie,
                    title: content.title,
                    description: content.description,
                    coverUrl: movie.coverImage
                        ? `http://localhost:3001/picture/${encodeURIComponent(movie.coverImage)}`
                        : 'http://localhost:3001/picture/default.png'
                }
            });
        } else {
            res.status(500).json({ error: 'Không thể lưu thay đổi' });
        }
    } catch (err) {
        console.error('Error updating movie:', err);
        res.status(500).json({ error: 'Lỗi khi cập nhật phim' });
    }
});

// DELETE - Xóa phim
router.delete('/movies/:id', (req, res) => {
    try {
        const { id } = req.params;

        const movies = loadMovies();
        const movieIndex = movies.findIndex(m => m.id === id);

        if (movieIndex === -1) {
            return res.status(404).json({ error: 'Không tìm thấy phim' });
        }

        const movie = movies[movieIndex];

        // Xóa file content
        deleteMovieContent(movie.contentFile);

        // Xóa khỏi danh sách
        movies.splice(movieIndex, 1);

        if (saveMovies(movies)) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: 'Không thể xóa phim' });
        }
    } catch (err) {
        console.error('Error deleting movie:', err);
        res.status(500).json({ error: 'Lỗi khi xóa phim' });
    }
});

// API tạo thumbnail cho movie cover (200x300px)
router.get('/movie-thumbnail/:filename', async (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const originalPath = path.join(PICTURE_DIR, filename);
    const thumbPath = path.join(ALT_MOVIE_DIR, filename);

    // 1. Check if thumbnail exists
    if (fs.existsSync(thumbPath)) {
        return res.sendFile(thumbPath);
    }

    // 2. Check if original exists
    if (!fs.existsSync(originalPath)) {
        // Return default image
        const defaultPath = path.join(PICTURE_DIR, 'default.png');
        if (fs.existsSync(defaultPath)) {
            return res.sendFile(defaultPath);
        }
        return res.status(404).json({ error: 'Image not found' });
    }

    // 3. Generate Thumbnail (200x300 for movie posters - 2:3 aspect ratio)
    try {
        await sharp(originalPath)
            .resize(200, 300, { fit: 'cover' })
            .toFile(thumbPath);

        // 4. Serve the new thumbnail
        res.sendFile(thumbPath);
    } catch (err) {
        console.error('Movie thumbnail generation error:', err);
        // Fallback to original if resize fails
        res.sendFile(originalPath);
    }
});

module.exports = router;
