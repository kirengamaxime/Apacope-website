const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Restrict file types and sizes (low-bandwidth friendly)
const ALLOWED = {
  'application/pdf': 'pdf',
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
};
const maxMb = Number(process.env.MAX_UPLOAD_MB || 10);

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED[file.mimetype]) return cb(null, true);
    cb(new Error('File type not allowed. Use PDF, Word, image (JPG/PNG/WebP) or MP4/WebM video.'));
  },
});

module.exports = { upload, ALLOWED };
