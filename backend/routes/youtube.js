/**
 * YouTube Feed Routes
 * API endpoints cho YouTube Feed & Collections
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const https = require('https');
const { COLLECTIONS_DIR, YOUTUBE_API_KEY } = require('../utils/helpers');

// ========== HELPER FUNCTIONS ==========
function fetchYouTubeAPI(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Error parsing response'));
                }
            });
        }).on('error', reject);
    });
}

function loadCollection(collectionName) {
    try {
        const filePath = path.join(COLLECTIONS_DIR, `${collectionName}.json`);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (err) {
        console.error(`Error loading collection ${collectionName}:`, err);
    }
    return { channels: [], videos: [], lastUpdate: null };
}

function saveCollection(collectionName, data) {
    try {
        const filePath = path.join(COLLECTIONS_DIR, `${collectionName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error(`Error saving collection ${collectionName}:`, err);
        return false;
    }
}

function parseDuration(isoDuration) {
    if (!isoDuration) return 0;
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    return hours * 3600 + minutes * 60 + seconds;
}

// ========== API ENDPOINTS ==========

// Lấy danh sách collections
router.get('/collections', (req, res) => {
    try {
        const files = fs.readdirSync(COLLECTIONS_DIR);
        const collections = files
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));

        res.json({ collections });
    } catch (err) {
        console.error('Error getting collections:', err);
        res.status(500).json({ error: 'Lỗi khi lấy danh sách collections' });
    }
});

// Tạo collection mới
router.post('/collections', (req, res) => {
    try {
        const { name } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Tên collection không được để trống' });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            return res.status(400).json({ error: 'Tên collection chỉ được chứa chữ, số, dấu gạch ngang và gạch dưới' });
        }

        const filePath = path.join(COLLECTIONS_DIR, `${name}.json`);

        if (fs.existsSync(filePath)) {
            return res.status(400).json({ error: 'Collection đã tồn tại' });
        }

        const newCollection = { channels: [], videos: [], lastUpdate: null };

        if (saveCollection(name, newCollection)) {
            res.json({ success: true, name });
        } else {
            res.status(500).json({ error: 'Không thể tạo collection' });
        }
    } catch (err) {
        console.error('Error creating collection:', err);
        res.status(500).json({ error: 'Lỗi khi tạo collection' });
    }
});

// Xóa collection
router.delete('/collections/:name', (req, res) => {
    try {
        const { name } = req.params;
        const filePath = path.join(COLLECTIONS_DIR, `${name}.json`);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Không tìm thấy collection' });
        }

        fs.unlinkSync(filePath);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting collection:', err);
        res.status(500).json({ error: 'Lỗi khi xóa collection' });
    }
});

// Đổi tên collection
router.put('/collections/:name/rename', (req, res) => {
    try {
        const { name } = req.params;
        const { newName } = req.body;

        if (!newName || newName.trim() === '') {
            return res.status(400).json({ error: 'Tên mới không được để trống' });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
            return res.status(400).json({ error: 'Tên collection chỉ được chứa chữ, số, dấu gạch ngang và gạch dưới' });
        }

        const oldFilePath = path.join(COLLECTIONS_DIR, `${name}.json`);
        const newFilePath = path.join(COLLECTIONS_DIR, `${newName}.json`);

        if (!fs.existsSync(oldFilePath)) {
            return res.status(404).json({ error: 'Collection không tồn tại' });
        }

        if (fs.existsSync(newFilePath)) {
            return res.status(400).json({ error: 'Tên collection mới đã tồn tại' });
        }

        fs.renameSync(oldFilePath, newFilePath);
        res.json({ success: true, newName });
    } catch (err) {
        console.error('Error renaming collection:', err);
        res.status(500).json({ error: 'Lỗi khi đổi tên collection' });
    }
});

// Lấy danh sách channels trong collection
router.get('/collections/:name/channels', (req, res) => {
    try {
        const { name } = req.params;
        const data = loadCollection(name);
        res.json(data);
    } catch (err) {
        console.error('Error getting channels:', err);
        res.status(500).json({ error: 'Lỗi khi lấy danh sách channels' });
    }
});

// Thêm channel mới vào collection
router.post('/collections/:name/channels', async (req, res) => {
    try {
        const { name } = req.params;
        let { channelId, customUrl, videoId } = req.body;

        // Nếu có videoId, lấy channelId từ video
        if (videoId) {
            try {
                const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
                const videoData = await fetchYouTubeAPI(videoUrl);
                if (videoData.items && videoData.items.length > 0) {
                    channelId = videoData.items[0].snippet.channelId;
                } else {
                    return res.status(404).json({ error: 'Không tìm thấy video' });
                }
            } catch (err) {
                console.error('Error fetching video info:', err);
                return res.status(500).json({ error: 'Lỗi khi lấy thông tin video' });
            }
        }

        // Lấy thông tin channel
        let url;
        if (channelId) {
            url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`;
        } else if (customUrl) {
            url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(customUrl)}&key=${YOUTUBE_API_KEY}`;
        } else {
            return res.status(400).json({ error: 'Thiếu channelId hoặc customUrl' });
        }

        const apiData = await fetchYouTubeAPI(url);

        if (!apiData.items || apiData.items.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy channel' });
        }

        const channelInfo = apiData.items[0];
        const data = loadCollection(name);

        // Kiểm tra xem channel đã tồn tại chưa
        const actualChannelId = channelInfo.id?.channelId || channelInfo.id;
        const existingIndex = data.channels.findIndex(c => c.id === actualChannelId);
        if (existingIndex >= 0) {
            return res.status(400).json({ error: 'Channel đã tồn tại trong collection' });
        }

        const newChannel = {
            id: actualChannelId,
            name: channelInfo.snippet.title,
            thumbnail: channelInfo.snippet.thumbnails?.default?.url || ''
        };

        data.channels.push(newChannel);

        if (saveCollection(name, data)) {
            res.json({ success: true, channel: newChannel });
        } else {
            res.status(500).json({ error: 'Không thể lưu channel' });
        }
    } catch (err) {
        console.error('Error adding channel:', err);
        res.status(500).json({ error: 'Lỗi khi thêm channel' });
    }
});

// Xóa channel khỏi collection
router.delete('/collections/:name/channels/:channelId', (req, res) => {
    try {
        const { name, channelId } = req.params;
        const data = loadCollection(name);

        const index = data.channels.findIndex(c => c.id === channelId);
        if (index < 0) {
            return res.status(404).json({ error: 'Không tìm thấy channel' });
        }

        data.channels.splice(index, 1);

        if (saveCollection(name, data)) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: 'Không thể xóa channel' });
        }
    } catch (err) {
        console.error('Error deleting channel:', err);
        res.status(500).json({ error: 'Lỗi khi xóa channel' });
    }
});

// Cập nhật thông tin channel (ví dụ: categories)
router.put('/collections/:name/channels/:channelId', (req, res) => {
    try {
        const { name, channelId } = req.params;
        const { categories } = req.body; // Expecting { categories: string[] }

        const data = loadCollection(name);
        const channel = data.channels.find(c => c.id === channelId);

        if (!channel) {
            return res.status(404).json({ error: 'Không tìm thấy channel' });
        }

        // Update fields if provided
        if (categories !== undefined) {
            if (!Array.isArray(categories)) {
                return res.status(400).json({ error: 'Categories phải là một mảng' });
            }
            channel.categories = categories;
        }

        if (saveCollection(name, data)) {
            res.json({ success: true, channel });
        } else {
            res.status(500).json({ error: 'Không thể lưu channel' });
        }
    } catch (err) {
        console.error('Error updating channel:', err);
        res.status(500).json({ error: 'Lỗi khi cập nhật channel' });
    }
});

// Cập nhật ghi chú cho collection
router.put('/collections/:name/note', (req, res) => {
    try {
        const { name } = req.params;
        const { note } = req.body;

        const data = loadCollection(name);
        data.note = note || ""; // Allow empty note to clear it

        if (saveCollection(name, data)) {
            res.json({ success: true, note: data.note });
        } else {
            res.status(500).json({ error: 'Không thể lưu ghi chú' });
        }
    } catch (err) {
        console.error('Error updating note:', err);
        res.status(500).json({ error: 'Lỗi khi cập nhật ghi chú' });
    }
});

// Lấy feed đã lưu từ collection
router.get('/collections/:name/feed', (req, res) => {
    try {
        const { name } = req.params;
        const data = loadCollection(name);
        res.json({
            videos: data.videos || [],
            lastUpdate: data.lastUpdate || null
        });
    } catch (err) {
        console.error('Error getting feed:', err);
        res.status(500).json({ error: 'Lỗi khi lấy feed' });
    }
});

// Làm mới feed cho collection
router.post('/collections/:name/refresh', async (req, res) => {
    try {
        const { name } = req.params;
        const { channelIds } = req.body; // Optional: Array of channel IDs to refresh
        const data = loadCollection(name);

        if (data.channels.length === 0) {
            return res.json({ videos: [], lastUpdate: null });
        }

        // Filter channels if channelIds is provided
        const channelsToRefresh = channelIds && Array.isArray(channelIds) && channelIds.length > 0
            ? data.channels.filter(c => channelIds.includes(c.id))
            : data.channels;

        if (channelsToRefresh.length === 0) {
            return res.json({ videos: [], lastUpdate: data.lastUpdate });
        }

        const newVideos = [];

        for (const channel of channelsToRefresh) {
            try {
                const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channel.id}&maxResults=50&order=date&type=video&key=${YOUTUBE_API_KEY}`;
                const apiData = await fetchYouTubeAPI(url);

                if (apiData.items) {
                    for (const item of apiData.items) {
                        newVideos.push({
                            videoId: item.id.videoId,
                            title: item.snippet.title,
                            description: item.snippet.description,
                            thumbnail: item.snippet.thumbnails.medium.url,
                            channelTitle: item.snippet.channelTitle,
                            channelId: channel.id,
                            publishedAt: item.snippet.publishedAt,
                            duration: 0
                        });
                    }
                }
            } catch (err) {
                console.error(`Error fetching videos for channel ${channel.id}:`, err);
            }
        }

        // Fetch duration for all videos in batches of 50
        const videoIds = newVideos.map(v => v.videoId);
        for (let i = 0; i < videoIds.length; i += 50) {
            const batchIds = videoIds.slice(i, i + 50).join(',');
            try {
                const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batchIds}&key=${YOUTUBE_API_KEY}`;
                const detailsData = await fetchYouTubeAPI(detailsUrl);

                if (detailsData.items) {
                    for (const item of detailsData.items) {
                        const video = newVideos.find(v => v.videoId === item.id);
                        if (video) {
                            video.duration = parseDuration(item.contentDetails.duration);
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching video details:', err);
            }
        }

        // Merge logic: Remove old videos of refreshed channels, add new ones, keep others.
        const channelIdsRefreshed = channelsToRefresh.map(c => c.id);
        const otherVideos = (data.videos || []).filter(v => !channelIdsRefreshed.includes(v.channelId));

        const finalVideoList = [...newVideos, ...otherVideos];
        finalVideoList.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

        data.videos = finalVideoList;
        data.lastUpdate = new Date().toISOString();
        saveCollection(name, data);

        res.json({ videos: data.videos, lastUpdate: data.lastUpdate });
    } catch (err) {
        console.error('Error refreshing feed:', err);
        res.status(500).json({ error: 'Lỗi khi làm mới feed' });
    }
});

module.exports = router;
