/**
 * Calendar Routes
 * API endpoints cho Calendar/Events và Tasks
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const { EVENTS_FILE, TASKS_FILE } = require('../utils/helpers');

// ========== EVENTS API ==========

router.get('/events', (req, res) => {
    try {
        if (fs.existsSync(EVENTS_FILE)) {
            const events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
            res.json(events);
        } else {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Lỗi khi đọc events' });
    }
});

router.post('/events', (req, res) => {
    try {
        const events = req.body;
        fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi khi lưu events' });
    }
});

// ========== TASKS API ==========

router.get('/tasks', (req, res) => {
    try {
        if (fs.existsSync(TASKS_FILE)) {
            const tasks = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
            res.json(tasks);
        } else {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Lỗi khi đọc tasks' });
    }
});

router.post('/tasks', (req, res) => {
    try {
        const tasks = req.body;
        fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi khi lưu tasks' });
    }
});

module.exports = router;
