"""The shared Test A paper: five MCQs and four descriptive questions."""
import random
import re

STOPWORDS = set("the and that this these those with from into for are was were have has had can will would could should being been does not also than then such some used use using means called known example examples following very each other their them which when where what how why its our your they you who one two more most through based given include includes about benefit designed particular completes installed type types".split())


def valid_paper(questions):
    if not isinstance(questions, list) or len(questions) != 9 or not all(isinstance(q, dict) for q in questions):
        return False
    if sum(q.get("type") == "mcq" for q in questions) != 5 or sum(q.get("type") == "descriptive" for q in questions) != 4:
        return False
    if len({q.get("text", "").strip() for q in questions}) != 9:
        return False
    for q in questions:
        if not q.get("text") or q.get("correctAnswer") is None or not str(q["correctAnswer"]).strip():
            return False
        if q["type"] == "mcq":
            options = q.get("options")
            if not isinstance(options, list) or len(options) != 4 or not all(isinstance(o, str) and o.strip() for o in options):
                return False
            if len({o.strip().casefold() for o in options}) != 4 or str(q["correctAnswer"]) not in ("0", "1", "2", "3"):
                return False
    return True


def application_software_paper(language):
    """Questions checked against Term 3, section 6.3.2 of the textbook."""
    if language == "Tamil":
        items = [
            ("பயன்பாட்டு மென்பொருள் யாருடைய பணிகளுக்காக உருவாக்கப்படுகிறது?", ["இறுதிப் பயனருக்காக", "விசைப்பலகைக்காக மட்டும்", "திரைக்காக மட்டும்", "அச்சுப்பொறிக்காக மட்டும்"], 0),
            ("ஒரு கணினியில் பயன்படுத்த பயன்பாட்டு நிரல்களை எங்கு நிறுவலாம்?", ["சுட்டியில்", "வன்தட்டில்", "திரையில்", "மின்கம்பியில்"], 1),
            ("பயன்பாட்டு மென்பொருளுக்கு எடுத்துக்காட்டு எது?", ["மின்வழங்கி", "தாய்ப்பலகை", "காணொளி இயக்கி", "விசைப்பலகை"], 2),
            ("உரைகளை உருவாக்கவும் திருத்தவும் பயன்படும் மென்பொருள் எது?", ["மின்வழங்கி", "கம்பி", "தாய்ப்பலகை", "சொல் செயலாக்க மென்பொருள்"], 3),
            ("பாடநூலின்படி பயன்பாட்டு நிரல் எத்தனை பயனர் பணிகளைச் செய்யலாம்?", ["ஒன்று அல்லது பல பணிகள்", "எந்தப் பணியும் செய்யாது", "சரியாக இரண்டு பணிகள் மட்டும்", "வன்பொருளைத் தொடுவது மட்டும்"], 0),
        ]
        prompts = [
            "பயன்பாட்டு மென்பொருள் என்றால் என்ன? அது இறுதிப் பயனருக்கு எவ்வாறு உதவுகிறது என்பதை விளக்குக.",
            "பயன்பாட்டு நிரல்களை ஒரு கணினியில் நிறுவி பயன்படுத்துவது பற்றி விளக்குக.",
            "பாடநூலில் உள்ள பயன்பாட்டு மென்பொருள் எடுத்துக்காட்டுகளை எழுதி அவற்றின் பணிகளை விளக்குக.",
            "காணொளி இயக்கி, ஒலி இயக்கி, சொல் செயலாக்க மென்பொருள், வரைதல் மற்றும் திருத்தும் கருவிகள் பயனரின் வெவ்வேறு பணிகளுக்கு எவ்வாறு உதவுகின்றன?",
        ]
        answers = ["இறுதிப் பயனருக்காக உருவாக்கப்பட்ட ஒரு நிரல் அல்லது நிரல்களின் தொகுப்பு பயன்பாட்டு மென்பொருள். அது பயனரின் ஒன்று அல்லது பல பணிகளைச் செய்ய உதவுகிறது.", "ஒரு கணினியில் பயன்படுத்த பயன்பாட்டு நிரல்களை வன்தட்டில் நிறுவலாம்.", "காணொளி இயக்கி, ஒலி இயக்கி, சொல் செயலாக்க மென்பொருள், வரைதல் கருவிகள் மற்றும் திருத்தும் மென்பொருள் ஆகியவை எடுத்துக்காட்டுகள்.", "காணொளி மற்றும் ஒலியை இயக்கவும், உரைகளை எழுதவும், படங்களை வரையவும், உள்ளடக்கத்தைத் திருத்தவும் இவை உதவுகின்றன."]
    else:
        items = [
            ("Who is application software designed to help?", ["The end user", "Only the keyboard", "Only the monitor", "Only the power supply"], 0),
            ("Where can application programs be installed for use on a computer?", ["Inside the mouse", "On the hard disk", "On the monitor screen", "In a power cable"], 1),
            ("Which is an example of application software?", ["A power supply", "A motherboard", "A video player", "A keyboard"], 2),
            ("Which application would you use to write and edit a document?", ["A power supply", "A connecting cable", "A motherboard", "Word processing software"], 3),
            ("According to the textbook, what can an application program do?", ["Complete one or more user tasks", "Perform no user tasks", "Perform exactly two tasks only", "Only make hardware touchable"], 0),
        ]
        prompts = [
            "Define application software and explain how it benefits an end user.",
            "Describe how application programs can be installed and used on a particular computer.",
            "Describe the examples of application software listed in the textbook and the tasks they help a user perform.",
            "Explain how video players, audio players, word processors, drawing tools and editing software meet different user needs.",
        ]
        answers = ["Application software is a program or group of programs designed for an end user to work on a computer. It completes one or more of the user's tasks.", "Application programs can be installed on the hard disk for use on a particular computer. They help the end user complete one or more tasks.", "Examples are video players, audio players, word processing software, drawing tools and editing software. They support playing media, writing, drawing and editing.", "Video players play videos; audio players play sound; word processors handle text; drawing tools create pictures; editing software changes content. These programs support different end-user tasks."]
    return ([{"type": "mcq", "text": text, "options": options, "correctAnswer": str(answer), "marks": 1} for text, options, answer in items]
            + [{"type": "descriptive", "text": text, "options": None, "correctAnswer": answer, "marks": 5} for text, answer in zip(prompts, answers)])


def build_paper(selected, language):
    title = selected["title"]
    if selected.get("chapter_key") == "t3_ch6" and selected.get("key") == "6.3.2":
        return application_software_paper(language)
    corpus = " ".join(selected.get("brief_points", [])) + " " + ("" if selected.get("explanation") else selected.get("excerpt", ""))
    sentences = list(dict.fromkeys(s.strip() for s in re.split(r"(?<=[.!?])\s+", corpus) if 30 <= len(s.strip()) <= 400 and not s.strip().endswith("?")))
    candidates = []
    vocabulary = []
    for sentence in sentences:
        words = list(re.finditer(r"[A-Za-z\u0b80-\u0bff]{3,}", sentence))
        words = [w for w in words if w[0].casefold() not in STOPWORDS]
        vocabulary.extend(w[0] for w in words)
        # Select meaningful words, retaining different questions from short sections.
        for word in sorted(words, key=lambda w: (-len(w[0]), w.start()))[:5]:
            candidates.append((sentence[:word.start()] + "________" + sentence[word.end():], word[0]))
    candidates = list(dict.fromkeys(candidates))
    if len(candidates) < 5:
        raise ValueError("There is not enough readable textbook material for this examination. Please choose a broader topic.")
    fallback = ["hardware", "software", "length", "mass", "heat", "water", "energy", "cell"] if language == "English" else ["வன்பொருள்", "மென்பொருள்", "நீளம்", "நிறை", "வெப்பம்", "நீர்", "ஆற்றல்", "செல்"]
    questions = []
    # Spread questions over the source, instead of taking five blanks from its first sentence.
    chosen = [candidates[round(i * (len(candidates) - 1) / 4)] for i in range(5)]
    for i, (statement, answer) in enumerate(chosen):
        distractors = []
        for word in vocabulary + fallback:
            if word.casefold() != answer.casefold() and word.casefold() not in {d.casefold() for d in distractors}:
                distractors.append(word)
            if len(distractors) == 3:
                break
        options = [answer] + distractors
        random.Random(f"{title}:{language}:{i}").shuffle(options)
        prefix = "Choose the word that completes the statement: " if language == "English" else "கூற்றை நிறைவு செய்யும் சொல்லைத் தேர்ந்தெடு: "
        questions.append({"type": "mcq", "text": prefix + statement, "options": options, "correctAnswer": str(options.index(answer)), "marks": 1})
    if language == "English":
        prompts = [f"Explain {title} in your own words. Include its meaning and main characteristics.",
                   f"Describe the examples, uses or observations of {title} given in the textbook.",
                   f"Explain the key facts and relationships in {title}. Include any steps, classifications or measurements covered in this topic.",
                   f"Write organised notes on {title}, explaining its important terms and connecting them with the textbook examples."]
    else:
        prompts = [f"{title} என்பதன் பொருளையும் முக்கியப் பண்புகளையும் உன் சொந்த வார்த்தைகளில் விளக்குக.",
                   f"{title} குறித்த பாடநூல் எடுத்துக்காட்டுகள், பயன்பாடுகள் அல்லது உற்றுநோக்கல்களை விவரிக்கவும்.",
                   f"{title} குறித்த முக்கிய உண்மைகளையும் தொடர்புகளையும் விளக்குக. இத்தலைப்பில் உள்ள படிகள், வகைகள் அல்லது அளவீடுகளைக் குறிப்பிடுக.",
                   f"{title} குறித்த முக்கியச் சொற்களை விளக்கி, பாடநூல் எடுத்துக்காட்டுகளுடன் தொடர்புபடுத்திக் குறிப்புகள் எழுதுக."]
    evidence = " ".join(sentences) or corpus
    questions.extend({"type": "descriptive", "text": text, "options": None, "correctAnswer": evidence, "marks": 5} for text in prompts)
    return questions
