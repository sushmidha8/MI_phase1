"""Read numbered learning topics directly from the locally supplied textbooks."""
import re
from functools import lru_cache
from pathlib import Path

import fitz

# Some source PDFs contain malformed image colour functions. Text extraction
# still raises real exceptions; disable MuPDF's repeated image diagnostics.
fitz.TOOLS.mupdf_display_errors(False)
fitz.TOOLS.mupdf_display_warnings(False)

BOOKS_DIR = Path(__file__).resolve().parent.parent / "books"
# Printed chapter starts, checked against each downloaded edition's contents page.
LAYOUTS = {
    ("English", 1): (4, [1, 14, 34, 55, 68, 80, 96]),
    ("Tamil", 1): (4, [1, 14, 34, 55, 68, 80, 96]),
    ("English", 2): (6, [1, 16, 32, 41, 57, 68, 85]),
    ("Tamil", 2): (4, [1, 19, 35, 45, 63, 74, 93]),
    ("English", 3): (4, [1, 14, 32, 46, 66, 79]),
    ("Tamil", 3): (4, [1, 15, 35, 50, 73, 87]),
}


def book_path(language, term):
    if language not in ("English", "Tamil"):
        raise ValueError("Choose English or Tamil.")
    matches = sorted(BOOKS_DIR.glob(f"Class_6_Science_{language}_Science_-_Term_{term}_*.pdf"))
    if not matches:
        raise FileNotFoundError(f"The {language} Term {term} textbook is not available.")
    return matches[0]


def page_range(language, term, chapter, total):
    offset, starts = LAYOUTS[(language, term)]
    start = starts[chapter - 1] + offset
    end = starts[chapter] + offset - 1 if chapter < len(starts) else total
    return start, end


def clean_text(text):
    text = re.sub(r"[\x00-\x08\x0b-\x1f\ue000-\uf8ff]", "", text)
    text = text.replace("\xad", "").replace("\ufffd", "")
    text = re.sub(r"([\u0bbe-\u0bcc])\1", r"\1", text)
    text = re.sub(r"([\u0b80-\u0bff])[A-Z]([\u0b80-\u0bff])", r"\1\2", text)
    text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text)
    return re.sub(r"\s+", " ", text).strip()


def _page_blocks(page):
    """Keep the book's two-column reading order and omit production footers."""
    lines = []
    middle = page.rect.width / 2
    for block in page.get_text("dict")["blocks"]:
        if "lines" not in block:
            continue
        for line in block["lines"]:
            spans = line["spans"]
            text = "".join(s["text"] for s in spans)
            if re.search(r"\.indd|\d{1,2}:\d{2}:\d{2}", text) or re.fullmatch(r"\s*\d+\s*", text):
                continue
            size = max(s["size"] for s in spans)
            if size < 9:
                continue
            bold = any("bold" in s["font"].lower() or s["flags"] & 16 for s in spans)
            x0, y0, _, y1 = line["bbox"]
            lines.append((1 if x0 >= middle - 10 else 0, y0, text, size, bold, y1))
    blocks = []
    previous = None
    for column, y0, text, size, bold, y1 in sorted(lines, key=lambda line: (line[0], line[1])):
        new_heading = bool(re.match(r"\s*[1-7]\s*\.\s*\d+", text))
        if (previous and not new_heading and previous[0] == column and abs(previous[1] - size) < 0.5
                and previous[2] == bold and y0 >= previous[4] - 1 and y0 - previous[3] < size * 0.7):
            old = blocks[-1]
            blocks[-1] = (old[0], old[1], old[2] + "\n" + text, old[3])
        else:
            blocks.append((column, y0, text, max(size, 13) if bold else size))
        previous = (column, size, bold, y1, y0)
    return blocks


@lru_cache(maxsize=64)
def _read_chapter(filename, modified, language, term, chapter):
    del modified  # Part of the cache key: replacing a PDF invalidates its entries.
    topics = []
    current = None
    seen = set()
    with fitz.open(filename) as book:
        start, end = page_range(language, term, chapter, len(book))
        heading = re.compile(rf"^({chapter}\s*\.\s*\d{{1,2}}(?:\s*\.\s*\d{{1,2}})?)\s*\.?\s+([^\d\s].*)", re.S)
        pending = ""
        for number in range(start, end + 1):
            for _, _, raw, size in _page_blocks(book[number - 1]):
                text = clean_text(raw)
                if re.fullmatch(rf"{chapter}\s*\.\s*\d+(?:\s*\.\s*\d+)?", text) and size >= 12.5:
                    pending = text
                    continue
                if pending:
                    raw = pending + " " + raw
                    text = clean_text(raw)
                    size = max(size, 13)
                    pending = ""
                if ((term == 1 and chapter == 1 and text == "Fast Facts") or
                        re.match(r"^(?:EVALUATION|Evaluation|Points to Remember|GLOSSARY|Glossary|மதிப்பீடு|நினைவில்|நிசைவில்)", text)):
                    current = None
                    # End matter must never become learning content or topics.
                    return topics
                match = heading.match(text)
                if match and size >= 12.5:
                    key = re.sub(r"\s", "", match[1])
                    if language == "English" and term == 2 and chapter == 7:
                        key = key.replace("7.1.", "7.")
                    if key in seen:
                        continue
                    seen.add(key)
                    # A heading's block can include its first paragraph.
                    lines = raw.strip().splitlines()
                    title = clean_text(lines[0])
                    # Wrapped headings use the same font; paragraph blocks are separate.
                    if len(lines) > 1 and len(text) < 170:
                        title = text
                    title = re.sub(rf"^{chapter}\s*\.\s*\d+(?:\s*\.\s*\d+)?\s*\.?\s*", "", title)
                    current = {"key": key, "title": title, "page_start": number,
                               "page_end": number, "paragraphs": [],
                               "sections": [{"title": title, "paragraphs": []}]}
                    topics.append(current)
                    if len(text) >= 170 and len(lines) > 1:
                        opening = clean_text(" ".join(lines[1:]))
                        current["paragraphs"].append(opening)
                        current["sections"][-1]["paragraphs"].append(opening)
                elif current:
                    current["page_end"] = number
                    if len(text) > 3:
                        current["paragraphs"].append(text)
                        is_heading = size >= 13 and len(text) <= 120 and not text.endswith((".", "?", "!")) and not re.match(r"^[\d•]", text)
                        if is_heading and text != current["sections"][-1]["title"]:
                            current["sections"].append({"title": text, "paragraphs": []})
                        else:
                            current["sections"][-1]["paragraphs"].append(text)
    return topics


def chapter_topics(language, term, chapter):
    path = book_path(language, term)
    if term == 1 and chapter == 7:
        return _computer_dialogue(str(path), path.stat().st_mtime_ns, language)
    return _read_chapter(str(path), path.stat().st_mtime_ns, language, term, chapter)


@lru_cache(maxsize=4)
def _computer_dialogue(filename, modified, language):
    """This chapter uses a conversation rather than numbered section headings."""
    del modified
    # These short explanations follow the conversation on printed pages 97–99.
    titles = {
        "English": ["Computers in everyday life", "History of computers", "Generations of computers", "Data and information", "Hardware, software and devices"],
        "Tamil": ["அன்றாட வாழ்வில் கணினிகள்", "கணினியின் வரலாறு", "கணினித் தலைமுறைகள்", "தரவும் தகவலும்", "வன்பொருள், மென்பொருள் மற்றும் கருவிகள்"],
    }
    points = {
        "English": [
            ["Computers help us draw, play games and learn.", "They are also used in shops, banks, railway stations and post offices.", "Laptops, tablets and smartphones can do many of the same tasks as computers."],
            ["Charles Babbage designed an early computer and is known as the father of the computer.", "Ada Lovelace developed commands for mathematical operations and is recognised as the first programmer.", "Before computers, people used tools such as the abacus for calculations."],
            ["The first generation of computers used vacuum tubes, and the second used transistors.", "The third generation used integrated circuits and the fourth used microprocessors.", "The textbook describes artificial intelligence as a feature of the fifth generation."],
            ["Data is material that a computer needs to process, such as numbers, letters and images.", "Information is data that has been processed into a useful form."],
            ["Software means the programs or commands used by a computer.", "Hardware means the physical parts of a computer.", "A keyboard and mouse send input to the computer, while a monitor and printer provide output.", "CPU stands for central processing unit."],
        ],
        "Tamil": [
            ["கணினியைப் படம் வரையவும், விளையாடவும், கற்றுக்கொள்ளவும் பயன்படுத்தலாம்.", "கடைகள், வங்கிகள், ரயில் நிலையங்கள், அஞ்சலகங்கள் போன்ற இடங்களிலும் கணினிகள் பயன்படுகின்றன.", "மடிக்கணினி, கைக்கணினி, திறன்பேசி ஆகியவற்றிலும் கணினியின் பல பணிகளைச் செய்யலாம்."],
            ["சார்லஸ் பாபேஜ் தொடக்ககாலக் கணினியை வடிவமைத்ததால் கணினியின் தந்தை என அழைக்கப்படுகிறார்.", "கணிதச் செயல்களுக்கான கட்டளைகளை உருவாக்கிய அடா லவ்லேஸ் முதல் நிரலாளர் எனப் போற்றப்படுகிறார்.", "கணினிக்கு முன்பு கணக்கிட அபாகஸ் போன்ற கருவிகள் பயன்பட்டன."],
            ["முதல் தலைமுறைக் கணினிகளில் வெற்றிடக் குழாய்களும், இரண்டாம் தலைமுறையில் திரிதடையங்களும் பயன்பட்டன.", "மூன்றாம் தலைமுறையில் ஒருங்கிணைந்த சுற்றுகளும், நான்காம் தலைமுறையில் நுண்செயலிகளும் பயன்பட்டன.", "ஐந்தாம் தலைமுறைக் கணினிகளின் சிறப்பாகச் செயற்கை நுண்ணறிவைப் பாடநூல் குறிப்பிடுகிறது."],
            ["எண்கள், எழுத்துகள், படங்கள் போன்ற கணினியால் செயலாக்கப்பட வேண்டியவை தரவுகள்.", "தரவைச் செயலாக்கிய பிறகு கிடைக்கும் பயனுள்ள வடிவமே தகவல்."],
            ["கணினிக்கான கட்டளைகளும் நிரல்களும் மென்பொருள் எனப்படும்.", "கணினியின் இயற்பாகங்கள் வன்பொருள் எனப்படும்.", "விசைப்பலகையும் சுட்டியும் உள்ளீட்டுக் கருவிகள்; திரையும் அச்சுப்பொறியும் வெளியீட்டுக் கருவிகள்.", "CPU என்பது மையச் செயலகம் ஆகும்."],
        ],
    }
    with fitz.open(filename) as book:
        sources = {p: clean_text(book[p - 1].get_text()) for p in (101, 102, 103)}
    pages = [(101, 101), (102, 102), (102, 103), (102, 103), (103, 103)]
    return [{"key": f"7.{i + 1}", "title": title, "page_start": pages[i][0],
             "page_end": pages[i][1], "paragraphs": [sources[p] for p in range(pages[i][0], pages[i][1] + 1)],
             "explanation": points[language][i]} for i, title in enumerate(titles[language])]


def selected_topic(language, term, chapter, key):
    topics = chapter_topics(language, term, chapter)
    topic = next((t for t in topics if t["key"] == key), None)
    if not topic:
        return None
    children = [t for t in topics if t["key"].startswith(key + ".")]
    if not children:
        return topic
    # Selecting a parent concept must include all of its nested textbook topics.
    parts = [topic] + children
    return {**topic, "paragraphs": [p for t in parts for p in t["paragraphs"]],
            "sections": [s for t in parts for s in t.get("sections", [{"title": t["title"], "paragraphs": t["paragraphs"]}])],
            "page_end": max(t["page_end"] for t in parts)}


def study_sections(topic):
    """Brief notes per source heading; complete details remain in each section."""
    if topic.get("explanation"):
        return [{"title": topic["title"], "points": topic["explanation"],
                 "textbook_text": "\n\n".join(topic["paragraphs"])}]
    sections = []
    for part in topic.get("sections", [{"title": topic["title"], "paragraphs": topic["paragraphs"]}]):
        paragraphs = list(dict.fromkeys(p for p in part["paragraphs"] if p.strip()))
        if not paragraphs:
            continue
        source = "\n\n".join(paragraphs)
        if len(source.split()) <= 100:
            # Short sections (such as Application Software) retain every fact,
            # including installation, purpose and all examples.
            points = paragraphs
        else:
            points = brief_points({"paragraphs": paragraphs})[:2]
            if not points:
                points = paragraphs[:1]
        sections.append({"title": part["title"], "points": points, "textbook_text": source})
    return sections


def brief_points(topic):
    """Short extractive explanations, without an API key or invented facts."""
    if topic.get("explanation"):
        return topic["explanation"]
    paragraphs = []
    for paragraph in topic["paragraphs"]:
        if re.match(r"^(?:Activity|Think|Figure|Fig\.|Table|Learning Objectives|ICT|http|www\.)", paragraph, re.I):
            continue
        paragraphs.append(paragraph)
    sentences = []
    for sentence in re.split(r"(?<=[.!?])\s+", " ".join(paragraphs)):
        # Skip questions, captions, tables and incomplete fragments.
        if (22 <= len(sentence) <= 350 and not sentence.endswith("?")
                and not re.match(r"^\d+[.)]", sentence)
                and len(re.findall(r"\d+", sentence)) <= 3
                and not re.match(r"^(?:Know|Let us|After|Now|Take|List|Compare|Observe|Notice|Find|Draw|Hold|Think|Yes|No|Similarly|Therefore|For example|From the activity)\b", sentence, re.I)
                and sentence.endswith((".", "!"))):
            if sentence not in sentences:
                sentences.append(sentence)
    # Prefer definitions and core facts, then keep their original reading order.
    important = re.compile(r"known as|defined|called|means|unit|is the|are the|எனப்படும்|என்பது|அலகு|குறிக்க", re.I)
    ranked = sorted(enumerate(sentences), key=lambda item: (not bool(important.search(item[1])), item[0]))[:4]
    points = [sentence for _, sentence in sorted(ranked)]
    if not points:
        points = [p for p in paragraphs if 35 <= len(p) <= 350 and not p.endswith("?")][:3]
    return points


def explanation_paragraphs(topic, sections, language, term, chapter, key):
    if term == 3 and chapter == 6 and key == "6.3.2":
        if language == "Tamil":
            return [
                "பயன்பாட்டு மென்பொருள் என்பது பயனரின் குறிப்பிட்ட பணிகளைச் செய்ய உருவாக்கப்பட்ட ஒரு நிரல் அல்லது நிரல்களின் தொகுப்பு. கணினியில் எழுதுதல், வரைதல், ஒலி கேட்டல் போன்ற பணிகளைச் செய்ய இது உதவுகிறது. இதன் முக்கிய நோக்கம் இறுதிப் பயனரின் தேவையை நிறைவேற்றுவதாகும்.",
                "ஒரு கணினியில் பயன்படுத்த பயன்பாட்டு நிரல்களை அதன் வன்தட்டில் நிறுவலாம். ஒவ்வொரு பயன்பாட்டு நிரலும் பயனரின் ஒன்று அல்லது பல பணிகளைச் செய்ய உதவும். எனவே, செய்ய வேண்டிய பணிக்கு ஏற்ற மென்பொருளைத் தேர்ந்தெடுத்துப் பயன்படுத்துகிறோம்.",
                "காணொளி இயக்கி, ஒலி இயக்கி, சொல் செயலாக்க மென்பொருள், வரைதல் கருவிகள் மற்றும் திருத்தும் மென்பொருள் ஆகியவை பாடநூலில் உள்ள எடுத்துக்காட்டுகள். காணொளி மற்றும் ஒலியை இயக்கவும், உரைகளை எழுதவும், படங்களை வரையவும், உள்ளடக்கத்தைத் திருத்தவும் இவை பயன்படுகின்றன.",
            ]
        return [
            "Application software is a program or group of programs made to help an end user do particular tasks on a computer. It is the software we use for activities such as writing, drawing or playing media. Its purpose is to meet the user's needs.",
            "Application programs can be installed on a computer's hard disk for use on that computer. A program may help the user complete one task or several tasks. We therefore choose an application according to the work we want to do.",
            "The textbook lists video players, audio players, word processing software, drawing tools and editing software as examples. These help us watch videos, listen to audio, prepare text documents, draw pictures and edit content. Each example supports a different kind of user activity.",
        ]
    pieces = []
    for section in sections:
        text = " ".join(section["points"]).strip()
        if text:
            prefix = section["title"] + ": " if section["title"] != topic["title"] else ""
            pieces.append(prefix + text)
    if len(pieces) < 3:
        pieces = [s.strip() for s in re.split(r"(?<=[.!?])\s+", " ".join(pieces)) if s.strip()]
    if len(pieces) < 2:
        pieces = [s.strip() for s in re.split(r"(?<=[.!?])\s+", " ".join(topic["paragraphs"])) if len(s.strip()) > 20]
    count = min(3, len(pieces))
    return [" ".join(pieces[i * len(pieces) // count:(i + 1) * len(pieces) // count]) for i in range(count)] if count else []


def lesson(language, term, chapter, key):
    topic = selected_topic(language, term, chapter, key)
    if not topic:
        raise ValueError("This topic is not in the selected chapter and language. Please choose it again.")
    points = brief_points(topic)
    if term == 1 and chapter == 1:
        # Plain-language notes checked against the three source sections. This
        # also avoids the Tamil edition's damaged font encoding in the overview.
        notes = {
            "English": {
                "1.1": ["Length is the distance between two points, such as the ends of your book.", "The standard unit of length is the metre (m). Use centimetres for small objects and kilometres for long distances.", "Place the object at zero on a ruler and look straight down at the reading to avoid parallax error."],
                "1.2": ["Mass tells us how much matter an object contains. Its SI unit is the kilogram (kg).", "Weight is the pull of gravity on an object. On the Moon, an object's weight is lower, but its mass stays the same.", "A beam balance measures mass by comparing an object with known standard masses."],
                "1.3": ["Time tells us how long an event takes. We use clocks to measure it.", "In the past, people estimated time using a sundial or a sand clock.", "Electronic clocks and stopwatches can measure short periods more precisely than these rough methods."],
            },
            "Tamil": {
                "1.1": ["இரு புள்ளிகளுக்கு இடையே உள்ள தொலைவே நீளம். எடுத்துக்காட்டாக, ஒரு புத்தகத்தின் இரு முனைகளுக்கு இடையே உள்ள தூரத்தை அளக்கலாம்.", "நீளத்தின் அடிப்படை அலகு மீட்டர் (m). சிறிய பொருள்களுக்கு சென்டிமீட்டரும், நீண்ட தூரங்களுக்கு கிலோமீட்டரும் பயன்படுகின்றன.", "அளவுகோலின் பூஜ்ஜியக் குறியில் பொருளை வைத்து, அளவிடும் புள்ளிக்கு நேர் மேலே பார்த்தால் இடமாறு தோற்றப் பிழையைத் தவிர்க்கலாம்."],
                "1.2": ["ஒரு பொருளில் உள்ள பருப்பொருளின் அளவே நிறை. அதன் SI அலகு கிலோகிராம் (kg).", "பொருளின் மீது செயல்படும் ஈர்ப்பு விசையே எடை. நிலவில் எடை குறையும்; ஆனால் நிறை மாறாது.", "தெரிந்த படித்தர நிறையுடன் பொருளை ஒப்பிட்டு பொதுத் தராசின் மூலம் நிறையை அளக்கலாம்."],
                "1.3": ["ஒரு நிகழ்வு நடைபெற எவ்வளவு நேரம் ஆகிறது என்பதைக் காலம் குறிக்கிறது. காலத்தை அளக்கக் கடிகாரங்களைப் பயன்படுத்துகிறோம்.", "முன்பு சூரியக் கடிகாரமும் மணல் கடிகாரமும் நேரத்தைத் தோராயமாக அறியப் பயன்பட்டன.", "மின்னணுக் கடிகாரங்களும் நிறுத்துக் கடிகாரங்களும் குறுகிய கால இடைவெளிகளை இன்னும் துல்லியமாக அளக்க உதவுகின்றன."],
            },
        }
        points = notes[language].get(key, points)
    if not points:
        raise ValueError("This topic could not be read clearly. Please use the linked textbook pages.")
    sections = study_sections(topic)
    if term == 3 and chapter == 6 and key == "6.3.2":
        concise = ["Application software is a program or group of programs that helps end users complete one or more tasks.",
                   "It can be installed on a computer's hard disk.",
                   "Examples: video players, audio players, word processors, drawing tools and editing software."] if language == "English" else [
                   "பயன்பாட்டு மென்பொருள் என்பது பயனரின் ஒன்று அல்லது பல பணிகளைச் செய்ய உதவும் ஒரு நிரல் அல்லது நிரல்களின் தொகுப்பு.",
                   "ஒரு கணினியில் பயன்படுத்த இதை வன்தட்டில் நிறுவலாம்.",
                   "எடுத்துக்காட்டுகள்: காணொளி இயக்கி, ஒலி இயக்கி, சொல் செயலாக்க மென்பொருள், வரைதல் கருவிகள் மற்றும் திருத்தும் மென்பொருள்."]
        sections = [{"title": topic["title"], "points": concise, "textbook_text": "\n\n".join(topic["paragraphs"])}]
    paragraphs = explanation_paragraphs(topic, sections, language, term, chapter, key)
    return {**topic, "brief_points": points, "learning_sections": sections, "explanation_paragraphs": paragraphs, "content": "\n\n".join(points),
            "excerpt": "\n\n".join(topic["paragraphs"])}
