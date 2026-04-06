/**
 * Config Routes
 * API endpoints cho Settings, Shortcuts và System Info
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const os = require('os');
const {
    SHORTCUTS_FILE,
    openWithDefaultApp,
    openFolder
} = require('../utils/helpers');

// ========== SHORTCUTS API ==========

router.get('/shortcuts', (req, res) => {
    try {
        if (fs.existsSync(SHORTCUTS_FILE)) {
            const data = JSON.parse(fs.readFileSync(SHORTCUTS_FILE, 'utf8'));
            data.sort((a, b) => (a.index || 0) - (b.index || 0));
            res.json(data);
        } else {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Lỗi khi đọc shortcuts' });
    }
});

router.post('/shortcuts', (req, res) => {
    try {
        const shortcuts = req.body;
        shortcuts.forEach((shortcut, i) => {
            if (shortcut.index === undefined || shortcut.index === null) {
                shortcut.index = i;
            }
            if (!shortcut.type) {
                shortcut.type = (shortcut.url && (shortcut.url.startsWith('http://') || shortcut.url.startsWith('https://'))) ? 'web' : 'local';
            }
        });
        fs.writeFileSync(SHORTCUTS_FILE, JSON.stringify(shortcuts, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi khi lưu shortcuts' });
    }
});

// ========== NETWORK INFO API ==========

router.get('/network-info', (req, res) => {
    try {
        const networkInterfaces = os.networkInterfaces();
        const ipAddresses = [];

        Object.keys(networkInterfaces).forEach(interfaceName => {
            networkInterfaces[interfaceName].forEach(iface => {
                if (iface.family === 'IPv4' && !iface.internal) {
                    ipAddresses.push({
                        interface: interfaceName,
                        address: iface.address,
                        netmask: iface.netmask
                    });
                }
            });
        });

        res.json({
            hostname: os.hostname(),
            platform: os.platform(),
            port: 3001,
            ipAddresses: ipAddresses,
            localUrl: 'http://localhost:3001',
            lanUrls: ipAddresses.map(ip => `http://${ip.address}:3001`)
        });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi khi lấy thông tin mạng: ' + err.message });
    }
});

// ========== OPEN FILE/FOLDER API ==========

router.post('/open-local', (req, res) => {
    try {
        const { path: filePath } = req.body;

        if (!filePath) {
            return res.status(400).json({ error: 'Không có đường dẫn!' });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File/folder không tồn tại!' });
        }

        openWithDefaultApp(filePath, (error) => {
            if (error) {
                return res.status(500).json({ error: 'Không thể mở file/folder: ' + error.message });
            }
            res.json({ success: true, message: 'Đã mở file/folder' });
        });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi: ' + err.message });
    }
});

router.post('/open-folder', (req, res) => {
    try {
        const { path: folderPath } = req.body;

        if (!folderPath) {
            return res.status(400).json({ success: false, error: 'Không có đường dẫn!' });
        }

        if (!fs.existsSync(folderPath)) {
            return res.status(404).json({ success: false, error: 'Thư mục không tồn tại!' });
        }

        openFolder(folderPath, (error) => {
            if (error) {
                return res.status(500).json({ success: false, error: 'Không thể mở thư mục: ' + error.message });
            }
            res.json({ success: true, message: 'Đã mở thư mục' });
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Lỗi: ' + err.message });
    }
});

module.exports = router;
