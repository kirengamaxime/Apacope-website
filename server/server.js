require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Copy .env.example to .env and set it.');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const origins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((o) => o.trim().replace(/\/$/, ''));
app.use(cors({ origin: origins, credentials: true, exposedHeaders: ['Content-Disposition'] }));
// Health check for the hosting platform
app.get('/health', (req, res) => res.json({ ok: true }));
app.use(compression()); // smaller responses for low-bandwidth users
app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize()); // blocks NoSQL operator injection ($, .)
app.use(xss()); // strips script payloads from input
app.use(hpp());
if (process.env.NODE_ENV !== 'test') app.use(morgan('tiny'));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 300 }));

fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/public', require('./routes/public'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/academic', require('./routes/academic'));
app.use('/api/students', require('./routes/students'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/assessments', require('./routes/assessments'));
app.use('/api/mark-submissions', require('./routes/marksubmissions'));
app.use('/api/resources', require('./routes/resources'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/report-cards', require('./routes/reportcards'));
app.use('/api/profiles', require('./routes/profiles'));

// Serve the built React app in production
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '7d' }));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use('/api', (req, res) => res.status(404).json({ message: 'Route not found' }));

// Central error handler
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: `File too large (max ${process.env.MAX_UPLOAD_MB || 10} MB)` });
  if (err.name === 'ValidationError') return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(', ') });
  if (err.code === 11000) return res.status(409).json({ message: 'Duplicate value: that record already exists' });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
  console.error(err);
  res.status(err.status || 400).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/apacope')
  .then(() => app.listen(PORT, () => console.log(`APACOPE API running on http://localhost:${PORT}`)))
  .catch((e) => { console.error('MongoDB connection failed:', e.message); process.exit(1); });