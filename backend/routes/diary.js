/**
 * Diary Routes
 * API endpoints cho Diary feature
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const upload = require('../middleware/upload');
const { DIARY_FILE, DIARY_PROFILE_FILE, WRITE_DIR, PICTURE_DIR, openWithDefaultApp } = require('../utils/helpers');

// ========== API ENDPOINTS ==========

// Lấy danh sách bài viết
router.get('/diary-posts', (req, res) => {
    try {
        if (fs.existsSync(DIARY_FILE)) {
            const posts = JSON.parse(fs.readFileSync(DIARY_FILE, 'utf8'));
            const postsWithContent = posts.map(post => {
                try {
                    if (post.textFile && fs.existsSync(path.join(WRITE_DIR, post.textFile))) {
                        const content = fs.readFileSync(path.join(WRITE_DIR, post.textFile), 'utf8');
                        return { ...post, content };
                    }
                    return { ...post, content: '' };
                } catch (err) {
                    console.error('Error reading text file:', err);
                    return { ...post, content: '' };
                }
            });
            res.json(postsWithContent);
        } else {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Lỗi khi đọc diary posts' });
    }
});

// Tạo bài viết mới
router.post('/diary-posts', upload.array('media', 10), (req, res) => {
    try {
        const { content, category } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Nội dung không được để trống' });
        }

        const id = Date.now().toString();
        const textFileName = `diary-${id}.txt`;
        const textFilePath = path.join(WRITE_DIR, textFileName);

        if (!fs.existsSync(WRITE_DIR)) {
            fs.mkdirSync(WRITE_DIR, { recursive: true });
        }
        fs.writeFileSync(textFilePath, content, 'utf8');

        const mediaFiles = req.files ? req.files.map(f => f.filename) : [];

        const newPost = {
            id,
            textFile: textFileName,
            media: mediaFiles,
            category: category || '',
            createdAt: new Date().toISOString()
        };

        let posts = [];
        if (fs.existsSync(DIARY_FILE)) {
            posts = JSON.parse(fs.readFileSync(DIARY_FILE, 'utf8'));
        }
        posts.push(newPost);
        fs.writeFileSync(DIARY_FILE, JSON.stringify(posts, null, 2));

        res.json({ success: true, post: newPost });
    } catch (err) {
        console.error('Error creating diary post:', err);
        res.status(500).json({ error: 'Lỗi khi tạo bài viết: ' + err.message });
    }
});

// Cập nhật bài viết
router.put('/diary-posts/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { content, category } = req.body;

        if (!fs.existsSync(DIARY_FILE)) {
            return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        }

        let posts = JSON.parse(fs.readFileSync(DIARY_FILE, 'utf8'));
        const postIndex = posts.findIndex(p => p.id === id);

        if (postIndex === -1) {
            return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        }

        const post = posts[postIndex];

        if (content !== undefined && post.textFile) {
            const textFilePath = path.join(WRITE_DIR, post.textFile);
            fs.writeFileSync(textFilePath, content, 'utf8');
        }

        if (category !== undefined) {
            posts[postIndex].category = category;
        }

        fs.writeFileSync(DIARY_FILE, JSON.stringify(posts, null, 2));
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating diary post:', err);
        res.status(500).json({ error: 'Lỗi khi cập nhật bài viết: ' + err.message });
    }
});

// Mở file diary trong editor mặc định
router.get('/open-diary-file/:id', (req, res) => {
    try {
        const { id } = req.params;

        if (!fs.existsSync(DIARY_FILE)) {
            return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        }

        let posts = JSON.parse(fs.readFileSync(DIARY_FILE, 'utf8'));
        const post = posts.find(p => p.id === id);

        if (!post) {
            return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        }

        if (!post.textFile) {
            return res.status(404).json({ error: 'Bài viết không có file text' });
        }

        const textFilePath = path.join(WRITE_DIR, post.textFile);

        if (!fs.existsSync(textFilePath)) {
            return res.status(404).json({ error: 'Không tìm thấy file text' });
        }

        openWithDefaultApp(textFilePath, (err) => {
            if (err) {
                console.error('Error opening file:', err);
                return res.status(500).json({ error: 'Không thể mở file: ' + err.message });
            }
            res.json({ success: true, message: 'Đã mở file trong ứng dụng mặc định' });
        });
    } catch (err) {
        console.error('Error opening diary file:', err);
        res.status(500).json({ error: 'Lỗi khi mở file: ' + err.message });
    }
});

// Xóa bài viết
router.delete('/diary-posts/:id', (req, res) => {
    try {
        const { id } = req.params;

        if (!fs.existsSync(DIARY_FILE)) {
            return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        }

        let posts = JSON.parse(fs.readFileSync(DIARY_FILE, 'utf8'));
        const post = posts.find(p => p.id === id);

        if (!post) {
            return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        }

        if (post.textFile) {
            const textFilePath = path.join(WRITE_DIR, post.textFile);
            if (fs.existsSync(textFilePath)) {
                fs.unlinkSync(textFilePath);
            }
        }

        posts = posts.filter(p => p.id !== id);
        fs.writeFileSync(DIARY_FILE, JSON.stringify(posts, null, 2));

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting diary post:', err);
        res.status(500).json({ error: 'Lỗi khi xóa bài viết: ' + err.message });
    }
});

// ========== DIARY PROFILE ==========

router.get('/diary-profile', (req, res) => {
    try {
        if (fs.existsSync(DIARY_PROFILE_FILE)) {
            const profile = JSON.parse(fs.readFileSync(DIARY_PROFILE_FILE, 'utf8'));
            res.json(profile);
        } else {
            res.json({ avatar: null, cover: null });
        }
    } catch (err) {
        res.status(500).json({ error: 'Lỗi khi đọc profile' });
    }
});

router.post('/diary-profile/avatar', upload.single('avatar'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Không có file được upload' });
        }

        let profile = { avatar: null, cover: null };
        if (fs.existsSync(DIARY_PROFILE_FILE)) {
            profile = JSON.parse(fs.readFileSync(DIARY_PROFILE_FILE, 'utf8'));
        }

        if (profile.avatar) {
            const oldPath = path.join(PICTURE_DIR, profile.avatar);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        profile.avatar = req.file.filename;
        fs.writeFileSync(DIARY_PROFILE_FILE, JSON.stringify(profile, null, 2));

        res.json({ success: true, filename: req.file.filename });
    } catch (err) {
        console.error('Error uploading avatar:', err);
        res.status(500).json({ error: 'Lỗi khi upload avatar: ' + err.message });
    }
});

router.post('/diary-profile/cover', upload.single('cover'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Không có file được upload' });
        }

        let profile = { avatar: null, cover: null };
        if (fs.existsSync(DIARY_PROFILE_FILE)) {
            profile = JSON.parse(fs.readFileSync(DIARY_PROFILE_FILE, 'utf8'));
        }

        if (profile.cover) {
            const oldPath = path.join(PICTURE_DIR, profile.cover);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        profile.cover = req.file.filename;
        fs.writeFileSync(DIARY_PROFILE_FILE, JSON.stringify(profile, null, 2));

        res.json({ success: true, filename: req.file.filename });
    } catch (err) {
        console.error('Error uploading cover:', err);
        res.status(500).json({ error: 'Lỗi khi upload cover: ' + err.message });
    }
});

module.exports = router;
