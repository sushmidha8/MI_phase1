import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import db from './database.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = 3001;

// ── Helper: promisify db.run / db.get / db.all ────────────────────────────────
const dbRun = (sql, params = []) =>
    new Promise((resolve, reject) =>
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        })
    );

const dbGet = (sql, params = []) =>
    new Promise((resolve, reject) =>
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
    );

const dbAll = (sql, params = []) =>
    new Promise((resolve, reject) =>
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
    );

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    const hash = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (username, password_hash) VALUES (?, ?)`, [username, hash], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username taken' });
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, username });
    });
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(400).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(password, row.password_hash);
        if (!match) return res.status(400).json({ error: 'Invalid credentials' });

        res.json({ id: row.id, username: row.username });
    });
});

// ── Assessment Routes (existing, preserved) ───────────────────────────────────
app.get('/api/assessments/:userId', (req, res) => {
    db.all(`SELECT * FROM assessments WHERE user_id = ?`, [req.params.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/assessments', (req, res) => {
    const { userId, type, score } = req.body;

    db.run(`DELETE FROM assessments WHERE user_id = ? AND type = ?`, [userId, type], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        db.run(`INSERT INTO assessments (user_id, type, score, is_completed) VALUES (?, ?, ?, 1)`,
            [userId, type, score], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ id: this.lastID, success: true });
            });
    });
});

app.post('/api/answers', (req, res) => {
    const { assessmentId, questionId, selectedOption, isCorrect } = req.body;
    db.run(`INSERT INTO answers (assessment_id, question_id, selected_option, is_correct) VALUES (?, ?, ?, ?)`,
        [assessmentId, questionId, selectedOption, isCorrect ? 1 : 0], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, success: true });
        });
});

// ── Learning Session Routes ───────────────────────────────────────────────────

// POST /api/sessions  — create a new learning session
app.post('/api/sessions', async (req, res) => {
    const { userId, topic, topicKey, subtopicKey, language, dominantIntelligence } = req.body;
    if (!userId || !topic || !language || !dominantIntelligence) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Ensure user exists or create placeholder user if logged in via client auth
    let user = await dbGet('SELECT id FROM users WHERE id = ?', [userId]).catch(() => null);
    if (!user) {
        // Create an entry in users table so foreign key integrity and user session consistency is preserved
        await dbRun('INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (?, ?, ?)',
            [userId, `student_${userId}`, 'local_session']).catch(() => null);
    }

    const validIntelligences = ['Spatial', 'Linguistic', 'Musical'];
    if (!validIntelligences.includes(dominantIntelligence)) {
        return res.status(400).json({ error: 'Invalid dominant intelligence value' });
    }

    try {
        const result = await dbRun(
            `INSERT INTO learning_sessions (user_id, topic, topic_key, subtopic_key, language, dominant_intelligence) VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, topic, topicKey || topic, subtopicKey || null, language, dominantIntelligence]
        );
        const session = await dbGet('SELECT * FROM learning_sessions WHERE id = ?', [result.lastID]);
        res.json(session);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sessions/:userId/latest — get the most recent session for a user
app.get('/api/sessions/:userId/latest', async (req, res) => {
    try {
        const session = await dbGet(
            'SELECT * FROM learning_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [req.params.userId]
        );
        if (!session) return res.status(404).json({ error: 'No session found' });
        res.json(session);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sessions/by-id/:sessionId — get session by ID
app.get('/api/sessions/by-id/:sessionId', async (req, res) => {
    try {
        const session = await dbGet('SELECT * FROM learning_sessions WHERE id = ?', [req.params.sessionId]);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.json(session);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/sessions/:sessionId/questions — save exam questions (Test A only)
app.post('/api/sessions/:sessionId/questions', async (req, res) => {
    const { sessionId } = req.params;
    const { questions } = req.body; // array of question objects

    if (!Array.isArray(questions) || questions.length !== 9
        || questions.some(q => !q || typeof q.text !== 'string' || !q.text.trim())
        || questions.filter(q => q.type === 'mcq').length !== 5
        || questions.filter(q => q.type === 'descriptive').length !== 4
        || questions.some(q => q.marks !== (q.type === 'mcq' ? 1 : 5))) {
        return res.status(400).json({ error: 'Test A requires 5 MCQs worth 1 mark each and 4 descriptive questions worth 5 marks each (25 marks).' });
    }

    // Preserve the saved Test A paper for this session.
    const existing = await dbAll('SELECT id FROM exam_questions WHERE session_id = ?', [sessionId]).catch(() => []);
    if (existing.length > 0) {
        return res.status(409).json({ error: 'Test A questions are already saved for this session.' });
    }

    const session = await dbGet('SELECT id FROM learning_sessions WHERE id = ?', [sessionId]).catch(() => null);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    try {
        const insertedIds = [];
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const result = await dbRun(
                `INSERT INTO exam_questions (session_id, question_index, question_type, question_text, options, correct_answer, marks)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    sessionId,
                    i,
                    q.type || 'mcq',
                    q.text,
                    q.options ? JSON.stringify(q.options) : null,
                    q.correctAnswer !== undefined ? String(q.correctAnswer) : null,
                    q.marks || 2
                ]
            );
            insertedIds.push(result.lastID);
        }
        res.json({ success: true, questionIds: insertedIds, count: insertedIds.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sessions/:sessionId/questions — fetch saved questions for a session
app.get('/api/sessions/:sessionId/questions', async (req, res) => {
    try {
        const rows = await dbAll(
            'SELECT * FROM exam_questions WHERE session_id = ? ORDER BY question_index ASC',
            [req.params.sessionId]
        );
        const questions = rows.map(r => ({
            id: r.id,
            index: r.question_index,
            type: r.question_type,
            text: r.question_text,
            options: r.options ? JSON.parse(r.options) : null,
            correctAnswer: r.correct_answer,
            marks: r.marks
        }));
        res.json(questions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/sessions/:sessionId/attempts — submit an exam attempt
app.post('/api/sessions/:sessionId/attempts', async (req, res) => {
    const { sessionId } = req.params;
    const { phase, answers, totalMarksPossible, marksObtained } = req.body;
    // answers: [{ questionId, studentAnswer, marksAwarded, feedback }]

    if (phase !== 'baseline') {
        return res.status(400).json({ error: 'Phase 1 supports Test A (baseline) only' });
    }
    if (typeof marksObtained !== 'number') {
        return res.status(400).json({ error: 'marksObtained must be a number' });
    }

    const session = await dbGet('SELECT id FROM learning_sessions WHERE id = ?', [sessionId]).catch(() => null);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    try {
        const attemptResult = await dbRun(
            `INSERT INTO exam_attempts (session_id, phase, total_marks_possible, marks_obtained) VALUES (?, ?, ?, ?)`,
            [sessionId, phase, totalMarksPossible || 0, marksObtained]
        );
        const attemptId = attemptResult.lastID;

        if (Array.isArray(answers)) {
            for (const ans of answers) {
                await dbRun(
                    `INSERT INTO exam_answers (attempt_id, question_id, student_answer, marks_awarded, feedback) VALUES (?, ?, ?, ?, ?)`,
                    [attemptId, ans.questionId, ans.studentAnswer || '', ans.marksAwarded || 0, ans.feedback || '']
                );
            }
        }

        res.json({ success: true, attemptId, phase });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sessions/:sessionId/attempts — get all attempts for a session
app.get('/api/sessions/:sessionId/attempts', async (req, res) => {
    try {
        const attempts = await dbAll(
            'SELECT * FROM exam_attempts WHERE session_id = ? ORDER BY submitted_at ASC',
            [req.params.sessionId]
        );
        res.json(attempts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sessions/:userId/all — all sessions for a user (for admin/debug)
app.get('/api/sessions/:userId/all', async (req, res) => {
    try {
        const sessions = await dbAll(
            'SELECT * FROM learning_sessions WHERE user_id = ? ORDER BY created_at DESC',
            [req.params.userId]
        );
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
