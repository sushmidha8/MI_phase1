"""Run with: python -m unittest discover -s backend -p 'test_*.py'."""
import unittest
import json
from unittest.mock import patch, Mock

from fastapi.testclient import TestClient
import main
from textbook_library import book_path, chapter_topics, lesson, page_range, LAYOUTS
from exam_paper import build_paper, valid_paper, application_software_paper


class TextbookTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    def test_downloaded_editions_have_different_page_offsets(self):
        self.assertEqual(page_range("English", 2, 1, 100), (7, 21))
        self.assertEqual(page_range("Tamil", 2, 1, 107), (5, 22))
        self.assertEqual(page_range("English", 1, 3, 108), (38, 58))
        self.assertTrue(book_path("English", 1).exists())

    def test_each_chapter_has_readable_topics(self):
        for (language, term), (_, starts) in LAYOUTS.items():
            for chapter in range(1, len(starts) + 1):
                with self.subTest(language=language, term=term, chapter=chapter):
                    topics = chapter_topics(language, term, chapter)
                    self.assertTrue(topics)
                    for topic in topics:
                        selected = lesson(language, term, chapter, topic["key"])
                        self.assertTrue(selected["brief_points"])
                        self.assertTrue(selected["learning_sections"])
                        self.assertGreaterEqual(len(selected["explanation_paragraphs"]), 2)
                        self.assertLessEqual(len(selected["explanation_paragraphs"]), 3)
                        self.assertTrue(valid_paper(build_paper({**selected, "chapter_key": f"t{term}_ch{chapter}"}, language)))

    def test_measurement_sections_are_separate_in_both_languages(self):
        for language in ("English", "Tamil"):
            topics = chapter_topics(language, 1, 1)
            self.assertEqual([t["key"] for t in topics], ["1.1", "1.2", "1.3"])
        length = lesson("English", 1, 1, "1.1")
        mass = lesson("English", 1, 1, "1.2")
        self.assertIn("distance", length["content"])
        self.assertNotIn("Mass is", length["excerpt"])
        self.assertIn("kilogram", mass["content"])
        self.assertNotIn("Evaluation", mass["excerpt"])
        self.assertLessEqual(len(mass["brief_points"]), 4)
        self.assertNotIn("platinum", lesson("English", 1, 1, "1.3")["excerpt"])

    def test_nested_and_split_headings(self):
        for language in ("English", "Tamil"):
            parts = chapter_topics(language, 2, 7)
            self.assertEqual([t["key"] for t in parts], ["7.1", "7.2", "7.3", "7.4"])
        self.assertIn("3.1.2", [t["key"] for t in chapter_topics("Tamil", 2, 3)])

    def test_content_links_to_the_selected_textbook_pages(self):
        response = self.client.post("/api/textbook/content", json={
            "topic_key": "t1_ch1", "subtopic_key": "1.2", "language": "English"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["title"], "Mass")
        self.assertIn("#page=11", data["source_url"])
        self.assertTrue(data["textbook_excerpt"])

    def test_original_pdf_can_be_opened_inline(self):
        response = self.client.get("/api/textbooks/English/1", headers={"Range": "bytes=0-4"})
        self.assertEqual(response.status_code, 206)
        self.assertEqual(response.content, b"%PDF-")
        self.assertIn("inline", response.headers["content-disposition"])

    def test_invalid_selection_is_not_replaced_with_a_different_topic(self):
        response = self.client.post("/api/textbook/content", json={
            "topic_key": "t1_ch1", "subtopic_key": "2.1", "language": "English"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.get("/api/chapters/t1_ch1/topics?language=French").status_code, 400)
        self.assertEqual(self.client.get("/api/chapters/unknown/topics").status_code, 404)

    def test_missing_pdf_has_an_actionable_error(self):
        with patch("main.chapter_topics", side_effect=FileNotFoundError("Textbook missing")):
            response = self.client.get("/api/chapters/t1_ch1/topics")
        self.assertEqual(response.status_code, 404)

    def test_offline_exam_stays_in_selected_section(self):
        with patch("main.get_gemini_client", return_value=None):
            response = self.client.post("/api/exam/generate", json={
                "topic_key": "t1_ch1", "subtopic_key": "1.2", "topic_title": "Mass", "language": "English"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["topic_title"], "Mass")
        self.assertTrue(data["questions"])
        self.assertEqual(len(data["questions"]), 9)
        self.assertEqual(sum(q["type"] == "mcq" for q in data["questions"]), 5)
        self.assertEqual(sum(q["type"] == "descriptive" for q in data["questions"]), 4)
        self.assertEqual(data["total_marks"], 25)
        self.assertEqual(data["total_marks"], sum(q["marks"] for q in data["questions"]))
        self.assertNotIn("length", str(data["questions"]).lower())
        tamil = lesson("Tamil", 1, 1, "1.2")
        self.assertTrue(main.topic_practice_questions(tamil, "Tamil"))

    def test_application_notes_keep_all_details_briefly(self):
        selected = lesson("English", 3, 6, "6.3.2")
        notes = " ".join(p for s in selected["learning_sections"] for p in s["points"]).lower()
        self.assertLess(len(notes.split()), 60)
        for phrase in ("program", "end users", "one or more tasks", "hard disk", "video players", "audio players", "word processors", "drawing tools", "editing software"):
            self.assertIn(phrase, notes)
        self.assertIn("particular computer", selected["learning_sections"][0]["textbook_text"])
        self.assertEqual(len(selected["explanation_paragraphs"]), 3)
        explanation = " ".join(selected["explanation_paragraphs"]).lower()
        for phrase in ("end user", "hard disk", "one task", "video players", "audio players", "word processing", "drawing tools", "editing software"):
            self.assertIn(phrase, explanation)

    def test_parent_topic_includes_each_nested_concept(self):
        selected = lesson("English", 3, 6, "6.3")
        titles = [s["title"] for s in selected["learning_sections"]]
        self.assertIn("System Software", titles)
        self.assertIn("Application Software", titles)
        self.assertIn("Parallax Error", [s["title"] for s in lesson("English", 1, 1, "1.1")["learning_sections"]])

    def test_ai_wrong_mix_falls_back_to_exact_paper(self):
        invalid = application_software_paper("English")
        invalid[-1]["type"] = "short"
        model = Mock()
        model.generate_content.return_value.text = json.dumps({"questions": invalid})
        with patch("main.get_gemini_client", return_value=model):
            response = self.client.post("/api/exam/generate", json={"topic_key": "t3_ch6", "subtopic_key": "6.3.2", "language": "English", "topic_title": "Application Software"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(valid_paper(response.json()["questions"]))
        self.assertEqual(response.json()["total_marks"], 25)

    def test_ai_marks_and_order_are_normalised(self):
        paper = list(reversed(application_software_paper("Tamil")))
        for q in paper:
            q["marks"] = 99
        model = Mock()
        model.generate_content.return_value.text = json.dumps({"questions": paper})
        with patch("main.get_gemini_client", return_value=model):
            response = self.client.post("/api/exam/generate", json={"topic_key": "t3_ch6", "subtopic_key": "6.3.2", "language": "Tamil", "topic_title": "Application Software"})
        self.assertEqual(response.status_code, 200)
        questions = response.json()["questions"]
        self.assertEqual([q["type"] for q in questions], ["mcq"] * 5 + ["descriptive"] * 4)
        self.assertEqual([q["marks"] for q in questions], [1] * 5 + [5] * 4)


if __name__ == "__main__":
    unittest.main()
