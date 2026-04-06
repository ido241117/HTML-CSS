/**
 * Download Routes
 * API endpoints cho YouTube DL và file downloads
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const XLSX = require('xlsx');
const { DOWNLOAD_DIR, PICTURE_DIR, TEMP_DIR, YTDLP_PATH, FFMPEG_PATH, getMusicDir } = require('../utils/helpers');

// ========== OBSIDIAN SYNC ==========
const OBSIDIAN_EXCEL = 'D:\\Project C\\New folder\\danh_sach_file.xlsx';
const OBSIDIAN_MD_DIR = 'D:\\Project C\\New folder\\Music';

/**
 * Đồng bộ file mới trong RAW sang thư mục Obsidian Music (tạo .md trống)
 * và cập nhật file Excel danh sách – tương tự sync_new_files.py
 */
function syncObsidianMusic() {
    try {
        const rawDir = getMusicDir();

        // 1. Lấy danh sách file hiện tại trong RAW
        if (!fs.existsSync(rawDir)) return;
        const currentFiles = fs.readdirSync(rawDir).filter(f =>
            fs.statSync(path.join(rawDir, f)).isFile()
        );

        // 2. Đọc danh sách đã có từ Excel
        let existingFiles = new Set();
        if (fs.existsSync(OBSIDIAN_EXCEL)) {
            const wb = XLSX.readFile(OBSIDIAN_EXCEL);
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
            // Header ở hàng 0, dữ liệu từ hàng 1
            for (let i = 1; i < rows.length; i++) {
                if (rows[i][0]) existingFiles.add(String(rows[i][0]));
            }
        } else {
            console.log('[Obsidian Sync] Chưa có Excel, coi tất cả là file mới.');
        }

        // 3. Tìm file mới
        const newFiles = currentFiles.filter(f => !existingFiles.has(f));
        if (newFiles.length === 0) {
            console.log('[Obsidian Sync] Không có file mới, đã đồng bộ.');
            return;
        }
        console.log(`[Obsidian Sync] Tìm thấy ${newFiles.length} file mới.`);

        // 4. Tạo file .md trống cho mỗi file mới
        if (!fs.existsSync(OBSIDIAN_MD_DIR)) {
            fs.mkdirSync(OBSIDIAN_MD_DIR, { recursive: true });
        }
        for (const name of newFiles) {
            const mdPath = path.join(OBSIDIAN_MD_DIR, `${name}.md`);
            if (!fs.existsSync(mdPath)) {
                fs.writeFileSync(mdPath, '', 'utf8');
                console.log(`[Obsidian Sync]  + Đã tạo: ${name}.md`);
            } else {
                console.log(`[Obsidian Sync]  ! Đã tồn tại (bỏ qua): ${name}.md`);
            }
        }

        // 5. Cập nhật lại file Excel với danh sách đầy đủ
        const wb = XLSX.utils.book_new();
        const data = [['Tên File'], ...currentFiles.map(f => [f])];
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, OBSIDIAN_EXCEL);
        console.log(`[Obsidian Sync] Đã cập nhật Excel: ${OBSIDIAN_EXCEL}`);
    } catch (err) {
        console.error('[Obsidian Sync] Lỗi:', err.message);
    }
}

// ========== API ENDPOINTS ==========

// Tải video/audio từ YouTube
router.post('/download-youtube', (req, res) => {
    const { url, type = 'mp3', folder = 'RAW' } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'Không có URL' });
    }

    // Xác định thư mục đích
    let targetDir;
    switch (folder) {
        case 'dowload':
            targetDir = DOWNLOAD_DIR;
            break;
        case 'picture':
            targetDir = PICTURE_DIR;
            break;
        case 'temp':
            targetDir = TEMP_DIR;
            break;
        case 'RAW':
        default:
            targetDir = getMusicDir();
            break;
    }

    // Đảm bảo thư mục tồn tại
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Xây dựng command dựa trên type
    const outputPath = path.join(targetDir, '%(title)s.%(ext)s');
    let command;

    if (type === 'video') {
        command = `"${YTDLP_PATH}" --no-playlist --no-check-certificate --js-runtime node --extractor-args "youtube:player_client=android,web" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 --ffmpeg-location "${FFMPEG_PATH}" -o "${outputPath}" "${url}"`;
    } else {
        command = `"${YTDLP_PATH}" --no-playlist --no-check-certificate --js-runtime node --extractor-args "youtube:player_client=android,web" -x --audio-format mp3 --ffmpeg-location "${FFMPEG_PATH}" -o "${outputPath}" "${url}"`;
    }

    exec(command, { maxBuffer: 1024 * 1024 * 10 }, async (error, stdout, stderr) => {
        if (error) {
            console.error('Download error:', error);
            return res.status(500).json({ error: 'Lỗi khi tải: ' + error.message });
        }

        // Tìm tên file vừa tải từ stdout
        let downloadedFile = null;
        const matchPattern = type === 'video'
            ? /\[download\]\s+([^\n]+\.mp4)\s+has\s+already\s+been\s+downloaded|\[Merger\]\s+Merging formats into\s+"([^"]+\.mp4)"/
            : /\[download\]\s+([^\n]+\.mp3)\s+has\s+already\s+been\s+downloaded|\[ExtractAudio\]\s+Destination:\s+([^\n]+\.mp3)/;

        const match = stdout.match(matchPattern);
        if (match) {
            // Lấy đường dẫn đầy đủ từ output hoặc chỉ tên file
            const fullPathOrName = match[1] || match[2];
            downloadedFile = path.basename(fullPathOrName);
        }

        const typeText = type === 'video' ? 'video' : 'nhạc';
        const folderText = folder === 'dowload' ? 'Dowload' : folder === 'picture' ? 'Picture' : folder === 'temp' ? 'Tempfile' : 'RAW';

        // --- Sync Obsidian Music (.md + Excel) sau khi tải vào RAW ---
        if (folder === 'RAW') {
            syncObsidianMusic();
        }

        // --- NEW: Sync to MongoDB if Music (RAW) ---
        if (folder === 'RAW' && type !== 'video' && downloadedFile) {
            try {
                const db = req.app.locals.db;
                if (db) {
                    const filePath = path.join(targetDir, downloadedFile);
                    let stats = { size: 0, mtime: new Date() };
                    try {
                        stats = fs.statSync(filePath);
                    } catch (e) { }

                    // Thêm vào DB
                    await db.collection('songs').updateOne(
                        { name: downloadedFile },
                        {
                            $set: {
                                name: downloadedFile,
                                url: `/music/${encodeURIComponent(downloadedFile)}`,
                                localPath: filePath,
                                size: stats.size,
                                datemodified: stats.mtime.toISOString(),
                                // Note & Cover để trống mặc định
                            },
                            $setOnInsert: { note: '', cover: '' }
                        },
                        { upsert: true }
                    );
                    console.log(`✓ Auto-synced ${downloadedFile} to MongoDB`);
                }
            } catch (err) {
                console.error('Error syncing to MongoDB after download:', err);
            }
        }
        // ------------------------------------------

        res.json({
            success: true,
            message: `Đã tải ${typeText} thành công vào thư mục ${folderText}!`,
            filename: downloadedFile,
            folder: folder,
            type: type
        });
    });
});

module.exports = router;
