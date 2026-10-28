# Multi-Intelligence Assessment — Phase 1

Local Phase 1 version of https://github.com/sushmidha8/MI.

## Included workflow

1. Register a student account or sign in.
2. Complete the timed, shuffled Spatial, Linguistic and Musical assessments.
3. View all three percentages and the dominant intelligence.
4. Select English or Tamil, then a Tamil Nadu State Board Class 6 Science chapter and topic.
5. Read the selected textbook passage and confirm reading.
6. Complete Test A: **5 MCQs × 1 mark + 4 descriptive questions × 5 marks = 25 marks**.
7. Submit answers and view the Phase 1 completion page.

Phase 1 ends after Test A. Personalized lessons, generated songs, video searches,
Test B and before/after comparison have been removed from this version.

## Run locally on Windows

Requirements: Node.js 22.12 or later (or 20.19+), Python 3.10+, and the six textbook PDFs.
From this folder:

```powershell
npm.cmd ci
python -m pip install -r backend/requirements.txt
npm.cmd run dev
```

Open http://localhost:5173 (or the address printed by Vite).
The account/assessment service runs on port 3001; the textbook/Test A service runs on port 8000.
Keep this terminal open. Press Ctrl+C to stop all three services.
A Python virtual environment is recommended if your existing environment has incompatible dependencies.

## Textbooks and assessment media

All six textbook PDFs have been copied from the existing local Downloads folder into `books/`.
The expected filenames are listed in `books/README.md`. PDFs are ignored by Git;
include `books/` when copying this local project to another computer.

Spatial videos are in `public/` so they are available in both development and production.
Musical assessment audio is in `public/musical/`; it does not need generated-song models or music setup.

## Scoring and saved data

Spatial and Linguistic questions retain their original weights (1–3).
Each Musical question retains its original weight of 1 (20 questions).
Each percentage is `round(earned weighted marks / maximum weighted marks × 100)`.
Spatial contains 5 video blocks and 15 questions; Linguistic contains 25 questions.
The original timer limits are 45 minutes for Spatial and 30 minutes each for Linguistic,
Musical and Test A. Existing assessment departure/clipboard rules are retained.

The original demo account form stores accounts in this browser's local storage.
Assessments, topic sessions, Test A papers and submitted answers are stored in `backend/app.db`.
The current signed-in student and reading confirmation persist for the browser tab session.
Sign-out clears that session. Use this as a local project demonstration; the inherited
browser account storage is not a production authentication system.

Test A records the baseline submission without showing answer keys or starting further lessons.
Generation works without an API key using the selected textbook section.
Optional Gemini assistance can be configured using `backend/.env.example`; offline descriptive
marking uses keyword overlap and should be reviewed by a teacher if marks are used formally.

## Checks

```powershell
npm.cmd run lint
npm.cmd run build
node --test src/utils/assessmentProtocol.test.js
python -m unittest discover -s backend -p 'test_*.py'
```

The Python tests require the six PDFs. `npm.cmd run preview` serves the built frontend;
the two backend services must also be running.
