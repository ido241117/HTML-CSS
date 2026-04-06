/**
 * Book Routes
 * API endpoints cho Book management
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const sharp = require('sharp');
const { BOOK_DIR, BOOK_METADATA_FILE, PICTURE_DIR, ALT_BOOK_DIR } = require('../utils/helpers');

// ========== HELPER FUNCTIONS ==========
function loadBookMetadata() {
    try {
        if (fs.existsSync(BOOK_METADATA_FILE)) {
            return JSON.parse(fs.readFileSync(BOOK_METADATA_FILE, 'utf8'));
        }
    } catch (err) {
        console.error('Error loading book metadata:', err);
    }
    return {};
}

function saveBookMetadata(metadata) {
    try {
        fs.writeFileSync(BOOK_METADATA_FILE, JSON.stringify(metadata, null, 2));
        return true;
    } catch (err) {
        console.error('Error saving book metadata:', err);
        return false;
    }
}

// Hàm đọc sách từ thư mục (đệ quy)
function scanBooksRecursive(dir, relativePath = '') {
    const books = [];

    try {
        const items = fs.readdirSync(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                // Nếu là thư mục, đệ quy vào trong
                const subPath = relativePath ? `${relativePath}/${item}` : item;
                const subBooks = scanBooksRecursive(fullPath, subPath);
                books.push(...subBooks);
            } else if (stat.isFile() && /\.(epub|pdf|mobi|azw3|txt|djvu|fb2)$/i.test(item)) {
                // Nếu là file sách
                const relativeFilePath = relativePath ? `${relativePath}/${item}` : item;
                books.push({
                    filename: item,
                    path: relativeFilePath,
                    folder: relativePath || null
                });
            }
        }
    } catch (err) {
        console.error('Error scanning directory:', dir, err);
    }

    return books;
}

// ========== API ENDPOINTS ==========

// API lấy danh sách sách
router.get('/books', (req, res) => {
    try {
        if (!fs.existsSync(BOOK_DIR)) {
            return res.json({ books: [], folders: [] });
        }

        const metadata = loadBookMetadata();
        const scannedBooks = scanBooksRecursive(BOOK_DIR);

        // Lấy danh sách folders
        const folders = [...new Set(scannedBooks.map(b => b.folder).filter(f => f))];

        // Map sang format đầy đủ
        const books = scannedBooks.map(book => {
            const bookMeta = metadata[book.path] || {};

            // Tên hiển thị: dùng custom name hoặc tên file
            const displayName = bookMeta.displayName || book.filename.replace(/\.[^.]+$/, '');

            // Ảnh bìa: dùng custom cover hoặc default.png
            let cover = 'http://localhost:3001/picture/default.png';
            if (bookMeta.cover) {
                cover = `http://localhost:3001/picture/${encodeURIComponent(bookMeta.cover)}`;
            }

            return {
                filename: book.filename,
                path: book.path,
                folder: book.folder,
                displayName,
                cover,
                customDisplayName: bookMeta.displayName || '',
                customCover: bookMeta.cover || ''
            };
        });

        res.json({ books, folders });
    } catch (err) {
        console.error('Error loading books:', err);
        res.status(500).json({ error: 'Không thể tải danh sách sách' });
    }
});

// API lấy danh sách ảnh trong thư mục picture
router.get('/picture-files', (req, res) => {
    try {
        if (!fs.existsSync(PICTURE_DIR)) {
            return res.json({ files: [] });
        }

        const files = fs.readdirSync(PICTURE_DIR);

        // Lọc chỉ lấy file ảnh
        const imageFiles = files.filter(f =>
            /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(f) &&
            fs.statSync(path.join(PICTURE_DIR, f)).isFile()
        );

        res.json({ files: imageFiles });
    } catch (err) {
        console.error('Error loading picture files:', err);
        res.status(500).json({ error: 'Không thể tải danh sách ảnh' });
    }
});

// API cập nhật metadata của sách
router.post('/books/metadata', (req, res) => {
    try {
        const { path: bookPath, displayName, cover } = req.body;

        if (!bookPath) {
            return res.status(400).json({ error: 'Thiếu đường dẫn file' });
        }

        const metadata = loadBookMetadata();

        if (!metadata[bookPath]) {
            metadata[bookPath] = {};
        }

        // Cập nhật thông tin
        if (displayName !== undefined) {
            metadata[bookPath].displayName = displayName || '';
        }

        if (cover !== undefined) {
            metadata[bookPath].cover = cover || '';
        }

        if (saveBookMetadata(metadata)) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: 'Không thể lưu metadata' });
        }
    } catch (err) {
        console.error('Error saving book metadata:', err);
        res.status(500).json({ error: 'Lỗi khi lưu metadata' });
    }
});

// API mở sách bằng ứng dụng mặc định
router.post('/books/open', (req, res) => {
    try {
        const { path: bookRelPath } = req.body;

        if (!bookRelPath) {
            return res.status(400).json({ error: 'Thiếu đường dẫn file' });
        }

        const bookPath = path.join(BOOK_DIR, bookRelPath);

        if (!fs.existsSync(bookPath)) {
            return res.status(404).json({ error: 'Không tìm thấy file' });
        }

        // Mở file bằng ứng dụng mặc định trên Windows
        exec(`start "" "${bookPath}"`, (error) => {
            if (error) {
                console.error('Error opening book:', error);
                return res.status(500).json({ error: 'Không thể mở file' });
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Error opening book:', err);
        res.status(500).json({ error: 'Lỗi khi mở sách' });
    }
});

// API tạo thumbnail cho book cover (200x300px)
router.get('/book-thumbnail/:filename', async (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const originalPath = path.join(PICTURE_DIR, filename);
    const thumbPath = path.join(ALT_BOOK_DIR, filename);

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

    // 3. Generate Thumbnail (200x300 for book covers - 2:3 aspect ratio)
    try {
        await sharp(originalPath)
            .resize(200, 300, { fit: 'cover' })
            .toFile(thumbPath);

        // 4. Serve the new thumbnail
        res.sendFile(thumbPath);
    } catch (err) {
        console.error('Book thumbnail generation error:', err);
        // Fallback to original if resize fails
        res.sendFile(originalPath);
    }
});

module.exports = router;
