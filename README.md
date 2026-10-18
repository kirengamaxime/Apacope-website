# APACOPE School Management and Learning Platform

Groupe Scolaire APACOPE - React (Vite + Tailwind + Recharts) frontend, Node/Express backend, MongoDB (Mongoose), JWT auth with role-based access control.

## Run it

You need Node 18+ and a running MongoDB (local `mongod` or a free MongoDB Atlas URI).

```bash
# 1. Backend
cd server
cp .env.example .env        # then set JWT_SECRET and MONGO_URI
npm install
npm run setup               # one-time: roles + attendance thresholds (deletes nothing)
npm run create-admin        # creates the first System Administrator (asks email, name, password)
npm run dev                 # API on http://localhost:5000

# 2. Frontend (second terminal)
cd client
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :5000)
```

For production: `cd client && npm run build`, then `cd server && npm start`. Express serves the built React app from `client/dist`.

## Public website (landing page)

Opening `/` shows the school website; the portal lives behind **Portal login** (`/login`, then `/dashboard`).
Sections: hero (with the next school events from the calendar), About, Programs (pick a program, then "Ask about..." pre-fills the contact form), Parent portal preview, photo Gallery with lightbox, School calendar (live from the database), common questions, and an Admissions / contact form. Messages from the form are saved in MongoDB and appear to the Head Teacher and DOS under **Website inquiries**.

**Design:** navy and the logo red, Newsreader (headings) and Public Sans (text), both bundled in the app so there is no external font request. The faint ruled lines and red margin line echo an exercise book, like the book in the logo. The portal uses the same system: dark sidebar with grouped menu, sharp cards, quiet tables, and a heatmap that prints the percentage in every cell.

**To make it yours:**
1. Edit `client/src/data/siteContent.js` - headline, description, programs, FAQ, admission steps, and the contact details (address, phone, email, hours, optional Google Maps embed link). Text marked `(PLACEHOLDER)` is sample wording, replace it with the school's real details. Empty contact fields are hidden.
2. Add real photos to `client/public/images/`: `gallery-1.jpg` to `gallery-6.jpg` (the Gallery section is always shown; until photos exist it shows labelled "coming soon" tiles) and optionally `hero.jpg` for a photo at the top of the page. Compress photos (under about 300 KB each) so the site stays fast on slow connections.
3. Rebuild with `npm run build` in `client/`.

## Accounts: who creates them

There are **no demo accounts**. Following the specification ("System Administrator: manage accounts, permissions, backups, system settings"):

1. `npm run create-admin` creates the first **System Administrator** (nothing is hard-coded; if you forget the password run `npm run create-admin -- --reset`).
2. The administrator logs in and opens **Users and roles > Create account** to issue logins for the **Head Teacher, DOS, Trainers, Accountant, Librarian** (and students, parents or another administrator). Leave the password empty to generate a one-time password; it is shown once, to hand over in person.
3. The new user must choose their own password at first login (the app is locked until they do).
4. **Reset password** on the same screen issues a new one-time password. Accounts can be disabled; the last active administrator can never be disabled or demoted.
5. Nobody else can create accounts (Head Teacher and DOS can only view the list). Every action is written to the audit log.

Typical start: admin creates the Head Teacher and DOS; the DOS sets up classes and admits students (Academic setup, Students); the admin creates trainer, accountant and librarian logins, then parent and student logins; the DOS links parents to students.

## What is where

```
server/
  models/index.js        all Mongoose schemas (User, Role, Student, Parent, Attendance, Assessment,
                         Resource, Announcement, AuditLog + AcademicYear, Term, Trade, Class, Module,
                         LearningOutcome, Timetable, Invoice, Payment, InventoryItem, Loan ...)
  middleware/auth.js     JWT verify, authorize(...roles) RBAC, visibleStudentIds (parent/student privacy)
  middleware/audit.js    audit log writer; middleware/upload.js = restricted, size-limited uploads
  routes/                auth, users(+roles, audit), academic, students, attendance, assessments,
                         resources, announcements, finance, inventory, calendar, dashboard, reports
  scripts/setup.js       one-time roles/thresholds; scripts/create-admin.js = first administrator
client/src/
  context/AuthContext    login state + role helper
  components/            Layout (role-based menu), ui (Heatmap, Stat, Modal, Pagination, hooks)
  pages/                 Dashboard, Attendance, Monitoring, Marks, Results, Resources, Announcements,
                         Timetable, Calendar, Students, Academic, Finance, Inventory, Reports, Users, AuditLogs
```

## How the main rules work

- **Attendance rules**: configurable thresholds live in the `AttendanceRule` document and are edited on the Absence Monitoring page (defaults: 3 = Follow-up, 5 = High Priority / contact parent, 8 = Urgent / management review). When a register is saved, absent students are re-evaluated; High Priority and Urgent students trigger a parent alert announcement.
- **Attendance %** counts present, late and excused as attended.
- **Grades**: A >= 80, B >= 70, C >= 60, D >= 50, E < 50. A module is "Competent" at 70% or more. Change `gradeFor` in `server/utils/helpers.js` to match your official scale.
- **Privacy**: parents only receive their linked children's data; students only their own. Enforced server-side in every query (`visibleStudentIds`), not just hidden in the UI.
- **Learning materials**: a trainer must choose Level, Trade, Class(es), Module and Learning Outcome, and can only post to classes/modules they are assigned to (Academic Setup > Trainer Assignments). Students see only material targeted at their class. Edutainment content from trainers stays hidden until the DOS or Head Teacher approves it.
- **Security**: bcrypt passwords, JWT expiry, login rate limiting, helmet, Mongo operator sanitising, XSS cleaning, HPP, upload whitelist (PDF, Word, JPG/PNG/WebP, MP4/WebM) capped by `MAX_UPLOAD_MB`.
- **Low bandwidth**: gzip responses, pagination everywhere, MongoDB indexes on student/class/date, code-split frontend (about 105 KB gzipped for the app shell).
- **SMS/Email hooks**: `server/utils/notify.js` (announcements) and the password-reset log line in `routes/auth.js`. Plug in your provider there.

## Things to do before going live

1. Set a long random `JWT_SECRET` and use MongoDB with authentication.
2. Create the administrator with `npm run create-admin` using a strong password (10+ characters).
3. Put the site behind HTTPS and set `CLIENT_URL` to your real domain.
4. Password-reset emails: fill the `SMTP_*` and `MAIL_FROM` lines in `server/.env` (Gmail: turn on 2-step verification, create an App password, use it as `SMTP_PASS`). Without them the link is only printed in the server log. Set `CLIENT_URL` to the real site address so the link opens correctly.
5. Schedule `mongodump` backups (the admin "backups" duty is operational, not built into the app).
6. Review the grading scale and fee amounts against school policy.
