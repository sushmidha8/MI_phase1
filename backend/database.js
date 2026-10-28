import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'app.db');

// Enable verbose mode
const sqlite = sqlite3.verbose();

const db = new sqlite.Database(dbPath, (err) => {
    if (err) {
        console.error('Database opening error: ', err);
    } else {
        console.log('Connected to SQLite Database');

        // Finish table creation before inspecting the schema for upgrades.
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS assessments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                type TEXT NOT NULL,
                score INTEGER DEFAULT 0,
                is_completed BOOLEAN DEFAULT 0,
                completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                assessment_id INTEGER,
                question_id TEXT NOT NULL,
                selected_option INTEGER NOT NULL,
                is_correct BOOLEAN NOT NULL,
                FOREIGN KEY (assessment_id) REFERENCES assessments(id)
            )`);

            // ── Phase 1 textbook sessions and Test A submissions ──────────────────

            db.run(`CREATE TABLE IF NOT EXISTS learning_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                topic TEXT NOT NULL,
                topic_key TEXT NOT NULL,
                subtopic_key TEXT,
                language TEXT NOT NULL,
                dominant_intelligence TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            // Upgrade existing local databases without changing older sessions.
            db.all('PRAGMA table_info(learning_sessions)', (err, columns) => {
                if (!err && !columns.some(column => column.name === 'subtopic_key')) {
                    db.run('ALTER TABLE learning_sessions ADD COLUMN subtopic_key TEXT');
                }
            });

            db.run(`CREATE TABLE IF NOT EXISTS exam_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                question_index INTEGER NOT NULL,
                question_type TEXT NOT NULL,
                question_text TEXT NOT NULL,
                options TEXT,
                correct_answer TEXT,
                marks INTEGER NOT NULL DEFAULT 2,
                FOREIGN KEY (session_id) REFERENCES learning_sessions(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS exam_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                phase TEXT NOT NULL CHECK (phase = 'baseline'),
                total_marks_possible INTEGER NOT NULL DEFAULT 0,
                marks_obtained REAL NOT NULL DEFAULT 0,
                submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES learning_sessions(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS exam_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attempt_id INTEGER NOT NULL,
                question_id INTEGER NOT NULL,
                student_answer TEXT,
                marks_awarded REAL NOT NULL DEFAULT 0,
                feedback TEXT,
                FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id),
                FOREIGN KEY (question_id) REFERENCES exam_questions(id)
            )`);
        });
    }
});

export default db;
