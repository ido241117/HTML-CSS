/**
 * Multer Configuration for File Uploads
 * Dùng chung cho các routes cần upload file
 */

const multer = require('multer');
const path = require('path');
const { PICTURE_DIR } = require('../utils/helpers');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, PICTURE_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ storage: storage });

module.exports = upload;
