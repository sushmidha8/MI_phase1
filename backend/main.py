"""
MI Assessment — FastAPI Python Backend
Handles: textbook content extraction, Test A question generation,
         and AI-assisted answer evaluation using Google Gemini.

Runs on port 8000.
Node/Express backend (port 3001) handles auth, sessions, persistence.
"""

import os
import sys
import re
import html
import json
import pdfplumber
from pypdf import PdfReader
from pathlib import Path
from typing import Optional

# Reconfigure stdout/stderr for Unicode (Tamil) support on Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from topic_textbooks import TOPIC_TEXTBOOKS, TOPIC_BRIEFS
from textbook_library import book_path, chapter_topics, lesson, page_range
from fastapi.responses import FileResponse
from exam_paper import build_paper, valid_paper

# ── Load env ──────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")
load_dotenv()

GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY", "")

# books directory (sibling of backend/)
BOOKS_DIR = BASE_DIR.parent / "books"
STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="MI Assessment — Phase 1 Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# ── Verified topic list (exact from TN State Board Class 6 Science textbooks) ──
TOPICS = [
    # Term 1
    {"key": "t1_ch1", "term": 1, "chapter": 1, "titleEn": "Measurements",                "titleTa": "அளவீடுகள்",                      "pages": {"English": (5, 17), "Tamil": (5, 17)}},
    {"key": "t1_ch2", "term": 1, "chapter": 2, "titleEn": "Force and Motion",            "titleTa": "விசையும் இயக்கமும்",             "pages": {"English": (18, 37), "Tamil": (18, 37)}},
    {"key": "t1_ch3", "term": 1, "chapter": 3, "titleEn": "Matter Around Us",            "titleTa": "நம்மைச் சுற்றியுள்ள பருப்பொருள்கள்", "pages": {"English": (38, 58), "Tamil": (38, 58)}},
    {"key": "t1_ch4", "term": 1, "chapter": 4, "titleEn": "The World of Plants",         "titleTa": "தாவர உலகம்",                     "pages": {"English": (59, 71), "Tamil": (59, 71)}},
    {"key": "t1_ch5", "term": 1, "chapter": 5, "titleEn": "The World of Animals",        "titleTa": "விலங்குலகம்",                    "pages": {"English": (72, 83), "Tamil": (72, 83)}},
    {"key": "t1_ch6", "term": 1, "chapter": 6, "titleEn": "Health and Hygiene",          "titleTa": "உடல் நலமும் சுகாதாரமும்",        "pages": {"English": (84, 99), "Tamil": (84, 99)}},
    {"key": "t1_ch7", "term": 1, "chapter": 7, "titleEn": "Computer - An Introduction",  "titleTa": "கணினி – ஓர் அறிமுகம்",           "pages": {"English": (100, 108), "Tamil": (100, 107)}},

    # Term 2
    {"key": "t2_ch1", "term": 2, "chapter": 1, "titleEn": "Heat",                         "titleTa": "வெப்பம்",                       "pages": {"English": (7, 21), "Tamil": (5, 22)}},
    {"key": "t2_ch2", "term": 2, "chapter": 2, "titleEn": "Electricity",                  "titleTa": "மின்னியல்",                     "pages": {"English": (22, 37), "Tamil": (23, 38)}},
    {"key": "t2_ch3", "term": 2, "chapter": 3, "titleEn": "Changes Around Us",           "titleTa": "நம்மைச் சுற்றி நிகழும் மாற்றங்கள்",  "pages": {"English": (38, 46), "Tamil": (39, 48)}},
    {"key": "t2_ch4", "term": 2, "chapter": 4, "titleEn": "Air",                          "titleTa": "காற்று",                        "pages": {"English": (47, 62), "Tamil": (49, 66)}},
    {"key": "t2_ch5", "term": 2, "chapter": 5, "titleEn": "The Cell",                     "titleTa": "செல்",                          "pages": {"English": (63, 73), "Tamil": (67, 77)}},
    {"key": "t2_ch6", "term": 2, "chapter": 6, "titleEn": "Human Organ Systems",          "titleTa": "மனித உறுப்பு மண்டலங்கள்",       "pages": {"English": (74, 84), "Tamil": (78, 92)}},
    {"key": "t2_ch7", "term": 2, "chapter": 7, "titleEn": "Parts of Computer", "titleTa": "கணினியின் பாகங்கள்"},

    # Term 3
    {"key": "t3_ch1", "term": 3, "chapter": 1, "titleEn": "Magnetism",                    "titleTa": "காந்தவியல்",                    "pages": {"English": (5, 17), "Tamil": (5, 18)}},
    {"key": "t3_ch2", "term": 3, "chapter": 2, "titleEn": "Water",                        "titleTa": "நீர்",                          "pages": {"English": (18, 35), "Tamil": (19, 38)}},
    {"key": "t3_ch3", "term": 3, "chapter": 3, "titleEn": "Chemistry in Everyday Life",    "titleTa": "அன்றாட வாழ்வில் வேதியியல்",     "pages": {"English": (36, 49), "Tamil": (39, 53)}},
    {"key": "t3_ch4", "term": 3, "chapter": 4, "titleEn": "Our Environment",             "titleTa": "நமது சுற்றுச்சூழல்",              "pages": {"English": (50, 69), "Tamil": (54, 76)}},
    {"key": "t3_ch5", "term": 3, "chapter": 5, "titleEn": "Plants in Daily Life",         "titleTa": "அன்றாட வாழ்வில் தாவரங்கள்",      "pages": {"English": (70, 82), "Tamil": (77, 90)}},
    {"key": "t3_ch6", "term": 3, "chapter": 6, "titleEn": "Hardware and Software",       "titleTa": "வன்பொருளும் மென்பொருளும்",       "pages": {"English": (83, 88), "Tamil": (91, 96)}},
]

TOPIC_MAP = {t["key"]: t for t in TOPICS}

# PDF filenames (relative to BOOKS_DIR)
PDF_FILES = {
    ("English", 1): "Class_6_Science_English_Science_-_Term_1_-_2025_edition-www.tntextbooks.in.pdf",
    ("English", 2): "Class_6_Science_English_Science_-_Term_2_-_2024_Edition-www.tntextbooks.in.pdf",
    ("English", 3): "Class_6_Science_English_Science_-_Term_3_-_2024_Edition-www.tntextbooks.in.pdf",
    ("Tamil",   1): "Class_6_Science_Tamil_Science_-_Term_1_-_2025_Edition-www.tntextbooks.in.pdf",
    ("Tamil",   2): "Class_6_Science_Tamil_Science_-_Term_2_-_2024_Edition-www.tntextbooks.in.pdf",
    ("Tamil",   3): "Class_6_Science_Tamil_Science_-_Term_3_-_2024_Edition-www.tntextbooks.in.pdf",
}

# ── PDF text extraction ────────────────────────────────────────────────────────

# ── In-memory PDF extraction cache ───────────────────────────────────────────
# Key: (language, topic_key)  Value: extracted raw text string
# First call reads PDF (~5 s). Every subsequent call is instant (0 ms).
EXTRACTED_CHAPTER_CACHE: dict = {}

def extract_chapter_text(language: str, topic_key: str) -> str:
    """
    Extract the complete textbook chapter text from the official PDF in the books/ folder.
    Reads all chapter pages without truncation and cleans up OCR/PDF artifacts.
    Results are cached in-memory so the PDF is only opened once per server run.
    """
    cache_key = (language, topic_key)
    if cache_key in EXTRACTED_CHAPTER_CACHE:
        return EXTRACTED_CHAPTER_CACHE[cache_key]

    topic = TOPIC_MAP.get(topic_key)
    if not topic:
        return ""

    term = topic["term"]
    pdf_filename = PDF_FILES.get((language, term))
    if not pdf_filename:
        return ""

    try:
        pdf_path = book_path(language, term)
    except (ValueError, FileNotFoundError):
        return ""

    # Page range mapping (1-based page numbers in PDF)
    pages_range = topic.get("pages", {}).get(language, (5, 18))
    start_page, end_page = pages_range

    extracted_pages = []

    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            start_page, end_page = page_range(language, term, topic["chapter"], total_pages)
            read_end = min(end_page, total_pages)
            for p in range(start_page - 1, read_end):
                page_text = pdf.pages[p].extract_text()
                if page_text and len(page_text.strip()) > 30:
                    cleaned_p = page_text.strip()
                    # Replace private-use unicode glyphs (often bullets/wingdings)
                    cleaned_p = re.sub(r'[\ue000-\uf8ff]', '• ', cleaned_p)
                    # Remove running headers/footers
                    cleaned_p = re.sub(r'(?m)^.*(?:Class\s*6\s*Science|TN\s*Textbook|www\.tntextbooks\.in|Term\s*\d+).*$', '', cleaned_p)
                    # Fix hyphenated words broken across line wraps (meas- \n urement -> measurement)
                    cleaned_p = re.sub(r'(\b\w+)-\s*\n\s*(\w+\b)', r'\1\2', cleaned_p)
                    extracted_pages.append(cleaned_p)
    except Exception as e:
        print(f"pdfplumber extraction error: {e}")

    if not extracted_pages:
        EXTRACTED_CHAPTER_CACHE[cache_key] = ""
        return ""

    combined = "\n\n".join(extracted_pages)
    combined = re.sub(r'\n{3,}', '\n\n', combined)
    result = combined.strip()
    EXTRACTED_CHAPTER_CACHE[cache_key] = result
    return result


# ── Gemini client setup ────────────────────────────────────────────────────────

def get_gemini_client():
    """Return a configured Gemini GenerativeModel instance, or None if unavailable."""
    if not GEMINI_API_KEY:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        return genai.GenerativeModel("gemini-3.8-flash")
    except Exception as e:
        print(f"Error configuring Gemini client: {e}")
        return None


# ── Pydantic models ────────────────────────────────────────────────────────────

class TopicListResponse(BaseModel):
    topics: list[dict]

class TextbookRequest(BaseModel):
    topic_key: str
    language: str  # "English" | "Tamil"
    subtopic_key: Optional[str] = None


class TextbookResponse(BaseModel):
    topic_key: str
    title: str
    language: str
    content: str
    content_available: bool
    source_note: str
    images: list[str] = []
    brief_points: list[str] = []
    source_url: Optional[str] = None
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    textbook_excerpt: Optional[str] = None
    learning_sections: list[dict] = []
    explanation_paragraphs: list[str] = []

class ExamGenerateRequest(BaseModel):
    topic_key: str
    language: str
    topic_title: str
    subtopic_key: Optional[str] = None

class ExamQuestion(BaseModel):
    index: int
    type: str          # "mcq" | "short" | "descriptive"
    text: str
    options: Optional[list[str]] = None
    correctAnswer: Optional[str] = None
    marks: int

class ExamGenerateResponse(BaseModel):
    questions: list[ExamQuestion]
    total_marks: int
    language: str
    topic_title: str

class EvaluateAnswerRequest(BaseModel):
    question_type: str
    question_text: str
    correct_answer: Optional[str]
    student_answer: str
    marks: int
    language: str

class EvaluateAnswerResponse(BaseModel):
    marks_awarded: float
    feedback: str

# ── Topic list endpoint ────────────────────────────────────────────────────────

@app.get("/api/topics", response_model=TopicListResponse)
def list_topics():
    """Return the curated list of verified Class 6 Science topics."""
    return {"topics": [
        {
            "key": t["key"],
            "term": t["term"],
            "chapter": t["chapter"],
            "titleEn": t["titleEn"],
            "titleTa": t["titleTa"],
        }
        for t in TOPICS
    ]}


def clean_latex_and_symbols(text: str) -> str:
    """Thoroughly clean LaTeX math markup, dollar signs, and unrendered symbol codes for 6th standard students."""
    if not text:
        return ""

    # Replace escaped backslashes first if any (e.g. \\text -> \text)
    text = text.replace(r'\\', '\\')

    # Replace common LaTeX math environments: \( ... \), \[ ... \]
    text = re.sub(r'\\(?:\[|\()', '', text)
    text = re.sub(r'\\(?:\]|\))', '', text)

    # Convert \frac{a}{b} -> a/b
    text = re.sub(r'\\frac\{([^}]+)\}\{([^}]+)\}', r'\1/\2', text)

    # Convert \text{...}, \mathrm{...}, \mathbf{...}, \mathit{...}, \textbf{...}
    text = re.sub(r'\\(?:text|mathrm|mathbf|mathit|textbf)\s*\{([^}]+)\}', r' \1 ', text)

    # Superscripts with braces: ^{2} -> ², ^{-3} -> ⁻³
    sub_sup = {
        '0':'⁰', '1':'¹', '2':'²', '3':'³', '4':'⁴', '5':'⁵', '6':'⁶', '7':'⁷', '8':'⁸', '9':'⁹',
        '+':'⁺', '-':'⁻', '=':'⁼', '(':'⁽', ')':'⁾', 'n':'ⁿ'
    }
    def replace_sup(match):
        inner = match.group(1)
        return "".join(sub_sup.get(c, c) for c in inner)

    text = re.sub(r'\^\{([^}]+)\}', replace_sup, text)
    # Single digit superscripts: ^2 -> ²
    for k, v in sub_sup.items():
        text = text.replace(f'^{k}', v)

    # Subscripts: _{2} -> ₂
    sub_map = {'0':'₀', '1':'₁', '2':'₂', '3':'₃', '4':'₄', '5':'₅', '6':'₆', '7':'₇', '8':'₈', '9':'₉'}
    text = re.sub(r'_\{([0-9]+)\}', lambda m: "".join(sub_map.get(c, c) for c in m.group(1)), text)
    for k, v in sub_map.items():
        text = text.replace(f'_{k}', v)

    # Replace common math commands
    literal_replacements = [
        (r'\times', '×'),
        (r'\div', '÷'),
        (r'\pm', '±'),
        (r'\degree', '°'),
        (r'^\circ', '°'),
        (r'\circ', '°'),
        (r'\rightarrow', '→'),
        (r'\leftarrow', '←'),
        (r'\le', '≤'),
        (r'\leq', '≤'),
        (r'\ge', '≥'),
        (r'\geq', '≥'),
        (r'\neq', '≠'),
        (r'\approx', '≈'),
        (r'\cdot', '·'),
        (r'\quad', ' '),
        (r'\qquad', ' '),
        (r'\,', ' '),
        (r'\;', ' '),
        (r'\:', ' '),
        (r'\left', ''),
        (r'\right', ''),
    ]
    for old, new in literal_replacements:
        text = text.replace(old, new)

    # Strip dollar signs ($...$ or $$...$$)
    text = re.sub(r'\$\$([^\$]+)\$\$', r' \1 ', text)
    text = re.sub(r'\$([^\$]+)\$', r' \1 ', text)
    text = text.replace('$', '')

    # Remove any remaining stray backslashed words
    text = re.sub(r'\\[a-zA-Z]+', '', text)

    # Clean up spacing around exponents, degrees, units, and punctuation
    text = re.sub(r'([a-zA-Z0-9])\s+([²³⁴⁵⁶⁷⁸⁹⁺⁻¹⁰])', r'\1\2', text)
    text = re.sub(r'°\s+C\b', '°C', text)
    text = re.sub(r'(\d+)\s+([m|c|k|m]?m|g|kg|s|°C)\b', r'\1 \2', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    text = re.sub(r' ([\.,;:!\?])', r'\1', text)

    return text.strip()


# ── Textbook Image Extraction ────────────────────────────────────────────────

def extract_chapter_images(language: str, topic_key: str) -> list[str]:
    """
    Extract textbook figures, diagrams and photographs from the PDF for this topic.
    Caches extracted images in backend/static/extracted_images/{topic_key}/.
    Returns list of absolute URLs to the images (e.g. ['http://localhost:8000/static/extracted_images/...']).
    """
    topic = TOPIC_MAP.get(topic_key)
    if not topic:
        return []
    term = topic["term"]
    pdf_filename = PDF_FILES.get((language, term))
    if not pdf_filename:
        return []
    try:
        pdf_path = book_path(language, term)
    except (ValueError, FileNotFoundError):
        return []

    out_dir = STATIC_DIR / "extracted_images" / topic_key
    out_dir.mkdir(parents=True, exist_ok=True)

    # Return cached if images already extracted
    existing = [f"http://localhost:8000/static/extracted_images/{topic_key}/{f.name}"
                for f in sorted(out_dir.glob("*.*")) if f.suffix.lower() in ('.jpg', '.jpeg', '.png')]
    if len(existing) >= 2:
        return existing[:8]

    pages_range = topic.get("pages", {}).get(language, (5, 18))
    start_page, end_page = pages_range
    saved_urls = []

    try:
        reader = PdfReader(str(pdf_path))
        total = len(reader.pages)
        start_page, end_page = page_range(language, term, topic["chapter"], total)
        read_end = min(end_page, total)
        for pno in range(start_page - 1, read_end):
            page = reader.pages[pno]
            for i, img in enumerate(page.images):
                # Filter out tiny icon glyphs (< 18 KB)
                if len(img.data) >= 18000:
                    ext = img.name.split('.')[-1].lower()
                    if ext in ('jpg', 'jpeg', 'png'):
                        fname = f"fig_p{pno+1}_{i}.{ext}"
                        fpath = out_dir / fname
                        with open(fpath, "wb") as f:
                            f.write(img.data)
                        saved_urls.append(f"http://localhost:8000/static/extracted_images/{topic_key}/{fname}")
                        if len(saved_urls) >= 8:
                            break
            if len(saved_urls) >= 8:
                break
    except Exception as e:
        print(f"Image extraction error for {topic_key}: {e}")

    return saved_urls


TEXTBOOK_CACHE = {}

def clean_and_structure_textbook(raw_text: str, title: str, language: str) -> str:
    """
    Deterministic textbook cleaner that structures raw textbook text into beautiful,
    properly aligned Markdown with clear headings and separated bullet points.
    Filters out trivial non-scientific filler activities while preserving all core concepts.
    """
    text = clean_latex_and_symbols(raw_text)

    # Remove running header/footer remnants
    text = re.sub(r'(?m)^.*(?:Class\s*6\s*Science|TN\s*Textbook|www\.tntextbooks\.in|Term\s*\d+|State\s*Board).*$', '', text)

    # Remove trivial classroom chore activities that do not teach real science
    # (e.g. measuring desk with handspan, counting paces in classroom)
    text = re.sub(r'(?i)activity\s*\d+[\s\S]*?(?=(?:##|\d+\.\d+|\n\n[A-Z]))', '', text)
    text = re.sub(r'(?i)செயல்பாடு\s*\d+[\s\S]*?(?=(?:##|\d+\.\d+|\n\n))', '', text)

    # Split into lines for structured alignment
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    structured_blocks = []
    current_list = []

    def flush_list():
        nonlocal current_list
        if current_list:
            structured_blocks.append("\n".join(current_list))
            current_list = []

    for line in lines:
        # Detect section headings (e.g., 1.1 Length, 1.2 Mass, Chapter Title)
        if re.match(r'^\d+\.\d+\s+[A-Za-z\u0B80-\u0BFF]', line) or line.startswith('#'):
            flush_list()
            clean_head = re.sub(r'^#+\s*', '', line)
            structured_blocks.append(f"\n## {clean_head}\n")
            continue

        # Detect subtopic titles (e.g., Multiple and Submultiples of SI Units)
        if len(line) < 45 and line.istitle() and not line.endswith('.'):
            flush_list()
            structured_blocks.append(f"\n### {line}\n")
            continue

        # Detect bullet or numbered items
        is_bullet = bool(re.match(r'^[-*•]\s+', line))
        is_numbered = bool(re.match(r'^\d+[\.\)]\s+', line))

        if is_bullet or is_numbered:
            clean_line = re.sub(r'^[-*•\d\.\)]+\s*', '- ', line)
            current_list.append(clean_line)
        else:
            flush_list()
            # Highlight definitions or key terms at start of line (e.g. Mass: or Length is...)
            if ':' in line and len(line.split(':')[0]) < 30:
                parts = line.split(':', 1)
                line = f"**{parts[0].strip()}:** {parts[1].strip()}"
            structured_blocks.append(line)

    flush_list()
    res = "\n\n".join(structured_blocks)
    res = re.sub(r'\n{3,}', '\n\n', res)
    return res.strip()


def format_textbook_with_gemini(raw_text: str, title: str, language: str) -> str:
    """
    Format the complete extracted textbook chapter into a clean, readable digital textbook.
    Does NOT summarize or make notes: presents the full lesson faithfully so students read
    it online just like the physical textbook manual.
    """
    cache_key = f"{title}_{language}"
    if cache_key in TEXTBOOK_CACHE:
        return TEXTBOOK_CACHE[cache_key]

    model = get_gemini_client()
    if not model or not raw_text:
        structured = clean_and_structure_textbook(raw_text, title, language)
        TEXTBOOK_CACHE[cache_key] = structured
        return structured

    if language == "Tamil":
        instruction = f"""நீங்கள் தமிழ்நாடு அரசு 6ஆம் வகுப்பு அறிவியல் பாடப்புத்தகத்தை மாணவர்களுக்குக் கணினி/மொபைல் திரையில் படிக்க வழங்கும் ஆசிரியர்.
பாடம்: '{title}' (தமிழ் வழி)

கீழே கொடுக்கப்பட்டுள்ளது பாடப்புத்தகத்தின் முழு உரை:
\"\"\"
{raw_text[:12000]}
\"\"\"

முக்கிய வடிவமைப்பு விதிகள்:
1. எக்காரணம் கொண்டும் குறிப்புகளாகவோ சுருக்கமாகவோ மாற்ற வேண்டாம். முழு பாடத்தின் கருத்துகளையும் வரிசையாக வழங்கவும்.
2. சீரமைப்பு மற்றும் பட்டியல் அமைப்பு (Alignment & Lists):
   - பண்புகள், வேறுபாடுகள், பணிகள், உதாரணங்களை குறிப்பிடும் போது கட்டாயமாக ஒவ்வொரு குறிப்பையும் தனி வரியில் அமைத்து (- குறிப்பு) அல்லது (1. குறிப்பு) என வரிசைப்படுத்தவும்.
   - பல கருத்துகளை ஒரே பத்தியாக குவித்து எழுத வேண்டாம்.
3. பயனில்லாத வகுப்பறை விளையாட்டுப் பயிற்சிகளை (கால் அடிகள் எண்ணுதல் போன்றவை) நீக்கவும். ஆனால் முக்கியமான அறிவியல் சோதனைகள் மற்றும் அட்டவணைகளை முழுமையாகத் தக்கவைக்கவும்.
4. அனைத்து தலைப்புகளையும் (##, ###) என்று தெளிவாகப் பிரிக்கவும்.
5. முக்கியமான அறிவியல் சொற்களை தடிமனாக (**bold**) காட்டவும்.
6. எக்காரணம் கொண்டும் LaTeX குறியீடுகளை ($1\\text{{ m}}$) பயன்படுத்த வேண்டாம். '1 மீ' அல்லது '1 m' என்று நேரடியாக எழுதவும்.
7. பாடத்தின் இறுதியில் வரும் மாதிரி வினாடி வினாக்களை சேர்க்க வேண்டாம்."""
    else:
        instruction = f"""You are presenting the official Tamil Nadu State Board Class 6 Science textbook on screen for students.
Chapter: '{title}'

Below is the complete text extracted from the textbook pages:
\"\"\"
{raw_text[:12000]}
\"\"\"

CRITICAL USER REQUIREMENTS FOR CLEAN ALIGNMENT & ACCURACY:
1. DO NOT MAKE SUMMARY NOTES. Retain all scientific concepts, definitions, explanations, and tables in full depth.
2. PERFECT ALIGNMENT & LIST STRUCTURE:
   - When presenting points (properties, components, functions, differences, examples), ALWAYS format each point on its own separate line as a markdown bullet list (- Point) or numbered list (1. Point).
   - NEVER lump multiple points into a single dense, unaligned paragraph.
   - Separate every section, table, and list with clear blank lines so they never overlap or clutter.
3. REMOVE TRIVIAL FILLER ACTIVITIES:
   - Completely omit trivial classroom chore activities that do not teach real science (e.g. measuring classroom with footsteps, counting desks, collecting leaves in a bucket).
   - RETAIN core scientific demonstrations, observational tables, and experiments that illustrate fundamental principles.
4. HEADINGS & TYPOGRAPHY:
   - Use clear textbook headings: `## Section Headings` (e.g. `## 1.1 Length`), `### Subtopics`, `#### Observations`.
   - Render all conversion charts and comparison tables as clean Markdown tables.
   - Highlight key scientific definitions and terms in **bold**.
5. ABSOLUTELY NO LaTeX math or dollar signs ($1\\text{{ m}}$ or $\\text{{cm}}$). Write plain natural units ('1 m', '100 cm', '10 kg', '25 °C').
6. DO NOT include the end-of-chapter quiz/evaluation questions in this reading material."""

    try:
        response = model.generate_content(instruction)
        formatted = response.text.strip()
        if formatted and len(formatted) > 300:
            formatted = clean_latex_and_symbols(formatted)
            for eval_marker in ["## Evaluation", "### Evaluation", "## மதிப்பீடு", "### மதிப்பீடு"]:
                if eval_marker in formatted:
                    formatted = formatted.split(eval_marker)[0].strip()
            TEXTBOOK_CACHE[cache_key] = formatted
            return formatted
    except Exception as e:
        print(f"Gemini textbook formatting error: {e}. Using deterministic structuring.")

    fallback_structured = clean_and_structure_textbook(raw_text, title, language)
    TEXTBOOK_CACHE[cache_key] = fallback_structured
    return fallback_structured


# ── Textbook content endpoint ──────────────────────────────────────────────────

@app.get("/api/chapters/{chapter_key}/topics")
def list_chapter_topics(chapter_key: str, language: str = "English"):
    chapter = TOPIC_MAP.get(chapter_key)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found.")
    try:
        sections = chapter_topics(language, chapter["term"], chapter["chapter"])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"chapter_key": chapter_key, "language": language, "topics": [
        {k: s[k] for k in ("key", "title", "page_start", "page_end")} for s in sections
    ]}


@app.get("/api/textbooks/{language}/{term}")
def read_textbook(language: str, term: int):
    try:
        path = book_path(language, term)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return FileResponse(path, media_type="application/pdf", filename=path.name,
                        content_disposition_type="inline")


@app.post("/api/textbook/content", response_model=TextbookResponse)
def get_textbook_content(req: TextbookRequest):
    """
    Extract and return complete textbook content for the given topic and language.
    Grounded strictly in the official TN State Board PDFs.
    """
    topic = TOPIC_MAP.get(req.topic_key)
    if not topic:
        raise HTTPException(status_code=404, detail=f"Unknown topic key: {req.topic_key}")

    lang = req.language
    if lang not in ("English", "Tamil"):
        raise HTTPException(status_code=400, detail="language must be 'English' or 'Tamil'")

    if req.subtopic_key:
        try:
            selected = lesson(lang, topic["term"], topic["chapter"], req.subtopic_key)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        return TextbookResponse(
            topic_key=req.topic_key, title=selected["title"], language=lang,
            content=selected["content"], content_available=True,
            brief_points=selected["brief_points"], textbook_excerpt=selected["excerpt"],
            learning_sections=selected["learning_sections"],
            explanation_paragraphs=selected["explanation_paragraphs"],
            page_start=selected["page_start"], page_end=selected["page_end"],
            source_url=f"http://localhost:8000/api/textbooks/{lang}/{topic['term']}#page={selected['page_start']}",
            source_note=f"Tamil Nadu Class 6 Science · Term {topic['term']} · Chapter {topic['chapter']} · Topic {req.subtopic_key} · PDF pages {selected['page_start']}–{selected['page_end']} ({lang})",
        )

    title = topic["titleEn"] if lang == "English" else topic["titleTa"]
    raw_content = extract_chapter_text(lang, req.topic_key)
    chapter_images = extract_chapter_images(lang, req.topic_key)

    brief_list = TOPIC_BRIEFS.get(req.topic_key, {}).get(lang, [])

    if raw_content and len(raw_content) > 100:
        formatted_content = format_textbook_with_gemini(raw_content, title, lang)
        return TextbookResponse(
            topic_key=req.topic_key,
            title=title,
            language=lang,
            content=formatted_content,
            content_available=True,
            source_note=f"Source: Tamil Nadu State Board Class 6 Science — Term {topic['term']}, Chapter {topic['chapter']} ({lang})",
            images=chapter_images,
            brief_points=brief_list
        )

    # Use verified curriculum textbook extraction
    textbook_entry = TOPIC_TEXTBOOKS.get(req.topic_key, {}).get(lang)
    if textbook_entry:
        return TextbookResponse(
            topic_key=req.topic_key,
            title=title,
            language=lang,
            content=textbook_entry,
            content_available=True,
            source_note=f"Source: Tamil Nadu State Board Class 6 Science — Term {topic['term']}, Chapter {topic['chapter']} ({lang})",
            images=chapter_images,
            brief_points=brief_list
        )
    else:
        return TextbookResponse(
            topic_key=req.topic_key,
            title=title,
            language=lang,
            content="",
            content_available=False,
            source_note=(
                f"Textbook content for '{title}' ({lang}) could not be extracted from the available PDF. "
                "Please refer to your physical or digital textbook for Term "
                f"{topic['term']}, Chapter {topic['chapter']}."
            ),
            images=chapter_images,
            brief_points=brief_list
        )


def topic_practice_questions(selected, language):
    """Offline paper uses the same five-MCQ/four-descriptive structure."""
    try:
        return build_paper(selected, language)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.post("/api/exam/generate", response_model=ExamGenerateResponse)
def generate_exam(req: ExamGenerateRequest):
    """
    Generate a rigorous Class 6 Science exam grounded directly in the chapter content.
    Tests deep conceptual understanding, definitions, units, and practical experiments.
    """
    topic = TOPIC_MAP.get(req.topic_key)
    if not topic:
        raise HTTPException(status_code=404, detail=f"Unknown topic key: {req.topic_key}")

    title = req.topic_title or (topic["titleEn"] if req.language == "English" else topic["titleTa"])
    raw_chapter = "" if req.subtopic_key else extract_chapter_text(req.language, req.topic_key)
    selected = None
    if req.subtopic_key:
        try:
            selected = lesson(req.language, topic["term"], topic["chapter"], req.subtopic_key)
        except (ValueError, FileNotFoundError) as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        title = selected["title"]
        raw_chapter = selected["excerpt"]

    paper_source = {**(selected or {}), "title": title, "chapter_key": req.topic_key,
                    "excerpt": raw_chapter or TOPIC_TEXTBOOKS.get(req.topic_key, {}).get(req.language, "")}

    model = get_gemini_client()
    questions_raw = []

    if model:
        try:
            prompt = f"""You are a senior Class 6 Science School Teacher setting a formal term examination paper for students who have studied the chapter '{title}' ({req.language}) from the Tamil Nadu State Board Class 6 Science curriculum.

Below is the official textbook content from the curriculum:
=== TEXTBOOK MATERIAL ===
{raw_chapter[:9000]}

TASK:
Create a rigorous, authentic school examination that tests how well the student understands the science concepts they just studied.

CRITICAL TEACHER REQUIREMENTS:
1. Every answer MUST be supported by the supplied textbook material. Test only this selected topic; do not include other chapter sections.
2. NEVER ask meta or trivial questions (DO NOT ask 'Which class/standard is this?', 'Which subject is this?', 'What is the chapter name?', 'Which board is this?').
3. Ask the questions that real school teachers ask in exams:
   - Scientific definitions and core principles
   - SI units, prefixes, and Class 6 numerical conversions
   - Reading instruments, accuracy, errors (e.g. parallax error), and precautions
   - Scientific comparisons (e.g. mass vs weight, beam balance vs electronic balance, contact vs non-contact force)
   - Step-by-step practical methods and experiments
4. If language is Tamil, questions, options, and model answers must be in high-quality academic Tamil as used in Tamil Nadu State Board textbooks.
5. NO LaTeX math tags ($1\\text{{ m}}$). Use clean natural units ('1 m', '100 cm', '10 kg', '25 °C').

Return ONLY a valid JSON object with EXACTLY this structure:
{{
  "questions": [
    // 5 Multiple Choice Questions (1 mark each)
    {{"index": 0, "type": "mcq", "text": "<question>", "options": ["<opt A>", "<opt B>", "<opt C>", "<opt D>"], "correctAnswer": "0", "marks": 1}},
    {{"index": 1, "type": "mcq", "text": "<question>", "options": ["<opt A>", "<opt B>", "<opt C>", "<opt D>"], "correctAnswer": "1", "marks": 1}},
    {{"index": 2, "type": "mcq", "text": "<question>", "options": ["<opt A>", "<opt B>", "<opt C>", "<opt D>"], "correctAnswer": "2", "marks": 1}},
    {{"index": 3, "type": "mcq", "text": "<question>", "options": ["<opt A>", "<opt B>", "<opt C>", "<opt D>"], "correctAnswer": "3", "marks": 1}},
    {{"index": 4, "type": "mcq", "text": "<question>", "options": ["<opt A>", "<opt B>", "<opt C>", "<opt D>"], "correctAnswer": "0", "marks": 1}},
    // Exactly 4 Descriptive Questions (5 marks each), no short-answer questions
    {{"index": 5, "type": "descriptive", "text": "<question>", "options": null, "correctAnswer": "<model answer with key facts>", "marks": 5}},
    {{"index": 6, "type": "descriptive", "text": "<question>", "options": null, "correctAnswer": "<model answer with examples or uses>", "marks": 5}},
    {{"index": 7, "type": "descriptive", "text": "<question>", "options": null, "correctAnswer": "<model answer explaining the process or relationships>", "marks": 5}},
    {{"index": 8, "type": "descriptive", "text": "<question>", "options": null, "correctAnswer": "<model answer covering the remaining important details>", "marks": 5}}
  ]
}}"""

            response = model.generate_content(prompt)
            text = response.text.strip()

            # Strip markdown code fences if present
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)

            parsed = json.loads(text)
            questions_raw = parsed.get("questions", [])

            if not valid_paper(questions_raw):
                raise ValueError("The paper must contain exactly five valid MCQs and four descriptive questions")

        except Exception as e:
            print(f"[Gemini] Exam generation failed: {e}. Using topic fallback for {req.topic_key}.")
            questions_raw = topic_practice_questions(paper_source, req.language)
    else:
        print(f"[Gemini] Client unavailable. Using topic fallback for {req.topic_key}.")
        questions_raw = topic_practice_questions(paper_source, req.language)

    questions_raw = sorted(questions_raw, key=lambda q: q["type"] != "mcq")
    questions = []
    total = 0
    for i, q in enumerate(questions_raw):
        clean_text = clean_latex_and_symbols(q.get("text", f"Question {i+1}"))
        raw_options = q.get("options")
        clean_opts = [clean_latex_and_symbols(opt) for opt in raw_options] if isinstance(raw_options, list) else None
        raw_ans = q.get("correctAnswer")
        clean_ans = clean_latex_and_symbols(str(raw_ans)) if raw_ans is not None else None

        eq = ExamQuestion(
            index=i,
            type=q.get("type", "mcq"),
            text=clean_text,
            options=clean_opts,
            correctAnswer=clean_ans,
            marks=1 if q["type"] == "mcq" else 5
        )
        questions.append(eq)
        total += eq.marks

    return ExamGenerateResponse(
        questions=questions,
        total_marks=total,
        language=req.language,
        topic_title=title
    )


# ── Answer evaluation endpoint ─────────────────────────────────────────────────

EVAL_PROMPT = """You are a strict but fair Class 6 science examiner.

Question: {question_text}
Question type: {question_type}
Maximum marks: {marks}
Model answer / key points: {correct_answer}
Student's answer: {student_answer}

Evaluate the student's answer fairly. Award marks out of {marks}.
- For MCQ: award full marks if the student's selected option index matches the correct answer index; 0 otherwise.
- For short-answer: award 0, 1, or 2 marks based on accuracy and completeness.
- For descriptive: award 0 to {marks} marks based on coverage of key points, accuracy, and clarity.

Respond with ONLY a JSON object (no markdown):
{{"marks_awarded": <number>, "feedback": "<one-sentence feedback>"}}"""


@app.post("/api/exam/evaluate", response_model=EvaluateAnswerResponse)
def evaluate_answer(req: EvaluateAnswerRequest):
    """
    Evaluate a single student answer using Gemini AI.
    For MCQs, performs exact-match evaluation without AI to save quota.
    """
    # MCQ — exact match, no AI needed
    if req.question_type == "mcq":
        if req.correct_answer is not None and str(req.student_answer).strip() == str(req.correct_answer).strip():
            return EvaluateAnswerResponse(marks_awarded=float(req.marks), feedback="Correct!")
        else:
            correct_label = req.correct_answer if req.correct_answer is not None else "unknown"
            return EvaluateAnswerResponse(marks_awarded=0.0, feedback=f"Incorrect. The correct answer was option {int(correct_label)+1}.")

    # Short / Descriptive — use Gemini if available
    model = get_gemini_client()
    if model and req.correct_answer:
        try:
            prompt = EVAL_PROMPT.format(
                question_text=req.question_text,
                question_type=req.question_type,
                marks=req.marks,
                correct_answer=req.correct_answer,
                student_answer=req.student_answer or "(no answer provided)"
            )
            response = model.generate_content(prompt)
            text = response.text.strip()
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)
            parsed = json.loads(text)
            awarded = float(parsed.get("marks_awarded", 0))
            awarded = max(0.0, min(float(req.marks), awarded))
            return EvaluateAnswerResponse(
                marks_awarded=awarded,
                feedback=parsed.get("feedback", "Evaluated by AI.")
            )
        except Exception as e:
            print(f"[Gemini] Evaluation failed: {e}. Using keyword fallback.")

    # Fallback: simple keyword overlap scoring
    answer_lower = (req.student_answer or "").lower()
    model_lower = (req.correct_answer or "").lower()
    model_words = set(re.findall(r'\b\w+\b', model_lower))
    student_words = set(re.findall(r'\b\w+\b', answer_lower))
    stop_words = {"a", "an", "the", "is", "are", "was", "were", "in", "on", "at", "to", "of", "and", "or", "it", "this", "that"}
    model_kw = model_words - stop_words
    student_kw = student_words - stop_words

    if not answer_lower.strip():
        return EvaluateAnswerResponse(marks_awarded=0.0, feedback="No answer provided.")

    if not model_kw:
        overlap_ratio = 0.5
    else:
        overlap = model_kw & student_kw
        overlap_ratio = len(overlap) / len(model_kw)

    awarded = round(overlap_ratio * req.marks, 1)
    awarded = max(0.0, min(float(req.marks), awarded))
    return EvaluateAnswerResponse(marks_awarded=awarded, feedback="Your answer was evaluated based on key concepts covered.")


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "MI Assessment AI & Media Backend",
        "gemini_api_configured": bool(GEMINI_API_KEY),
        "books_dir_exists": BOOKS_DIR.exists(),
        "pdfs_found": len(list(BOOKS_DIR.glob("*.pdf"))) if BOOKS_DIR.exists() else 0,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
