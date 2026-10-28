# Repository Guidelines

## Project Structure & Module Organization

This application assesses spatial, linguistic, and musical intelligence. The repository root contains `package.json` and `vite.config.js`; run commands from this directory.

- `src/`: React entry points, application routing, and shared CSS. Feature screens live in `src/components/`; helpers live in `src/utils/`.
- `public/` and `src/assets/`: assessment media and frontend images.
- `backend/server.js` and `backend/database.js`: Express API and SQLite persistence (`backend/app.db`).
- `backend/main.py`: FastAPI service for textbook extraction, Test A generation, and answer evaluation. Curriculum data lives in `topic_questions.py` and `topic_textbooks.py`.
- `books/`: locally supplied textbook PDFs; see its README for expected filenames. Extracted images live in `backend/static/`.

## Build, Test, and Development Commands

- `npm ci`: install JavaScript dependencies from the lockfile.
- `npm run dev`: start Vite, Express on port 3001, and FastAPI on port 8000 concurrently. Requires Python and its dependencies to be installed separately.
- `npm run build`: create the frontend production bundle in `dist/`.
- `npm run preview`: serve the built frontend locally; backend services must run separately.
- `npm run lint`: check JavaScript and JSX with ESLint, including React Hooks and Fast Refresh rules.

Install Python dependencies with `python -m pip install -r backend/requirements.txt`. Google Gemini support is optional.

## Coding Style & Naming Conventions

Use ES modules and functional React components. Name component files in PascalCase (for example, `TopicSelect.jsx`), JavaScript helpers in camelCase, and Python modules/functions in snake_case. Match surrounding formatting: frontend code generally uses two-space indentation, while backend code uses four spaces. Preserve each file's existing quote and semicolon style. ESLint is configured; no dedicated formatter is configured. Reuse the muted ivory/sage tokens and shared controls in `src/index.css`; use `SiteChrome.jsx` for the website header/footer. Keep keyboard focus visible and support narrow screens.

## Testing Guidelines

Run textbook checks with `python -m unittest discover -s backend -p 'test_*.py'`; these require the local PDFs. Run browser-event protocol checks with `node --test src/utils/assessmentProtocol.test.js`. No coverage threshold is configured. Before submitting, run lint and build, then manually verify affected learning flows with both backend services running. Record commands, outcomes, and reproduction steps in the PR.

## Commit & Pull Request Guidelines

The Git history uses concise subjects with conventional prefixes, such as `feat: complete multi-intelligence assessment, textbook learning, and examination modules`. Use `feat:` for features and `fix:` for corrections, followed by an imperative description. Keep PRs focused, describe behavior changes, link relevant issues, and include screenshots for UI changes plus validation results.

## Security & Configuration

Store optional `GEMINI_API_KEY` in `backend/.env`. Keep secrets, SQLite databases, Python caches and textbook PDFs out of commits. This checkout contains Phase 1 only: registration, three intelligence assessments, profiling, topic selection, textbook reading and Test A. Do not add later learning modules, Test B or performance comparison without a new user request.
