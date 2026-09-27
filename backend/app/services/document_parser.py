import io
import os
import re
import csv
import uuid
import logging
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

from app.schemas.question_import import ExtractedQuestion, ImportedOption, ImportPreviewResponse
from app.services.ocr_service import get_ocr_service, validate_image_file

logger = logging.getLogger("document_parser")

ALLOWED_EXTENSIONS = {
    ".pdf", ".docx", ".pptx", ".txt", ".csv", ".xlsx", ".jpg", ".jpeg", ".png"
}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
    "application/octet-stream"
}
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB

COMMON_SUBJECTS = [
    "DBMS", "Database Management Systems", "Operating Systems", "Computer Networks",
    "Software Engineering", "Artificial Intelligence", "Machine Learning",
    "Data Structures", "Algorithms", "Python Programming", "Web Development",
    "Cyber Security", "Cloud Computing", "Mathematics", "Computer Science",
    "Physics", "Chemistry", "English"
]

def normalize_text_for_comparison(text: str) -> str:
    """Normalize text by lowercasing, removing special characters, and collapsing whitespace."""
    if not text:
        return ""
    clean = re.sub(r"[^\w\s]", " ", text.lower())
    return " ".join(clean.split())

def calculate_token_similarity(text1: str, text2: str) -> float:
    """Calculates Jaccard similarity between two texts based on normalized word tokens."""
    words1 = set(normalize_text_for_comparison(text1).split())
    words2 = set(normalize_text_for_comparison(text2).split())
    if not words1 or not words2:
        return 0.0
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    return len(intersection) / len(union)

class DocumentParserService:
    def validate_file(self, filename: str, file_bytes: bytes, content_type: Optional[str] = None) -> Tuple[bool, str, str]:
        """Validates extension, size, and returns normalized extension."""
        if not file_bytes or len(file_bytes) == 0:
            return False, "Uploaded file is empty.", ""
        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            max_mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
            return False, f"File size exceeds maximum allowed limit of {max_mb}MB.", ""
        
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            allowed_list = ", ".join(sorted(ALLOWED_EXTENSIONS))
            return False, f"Unsupported file type '{ext}'. Supported types: {allowed_list}", ""
        
        return True, "", ext

    def extract_raw_text(self, file_bytes: bytes, ext: str, filename: str) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Extracts text or structured tabular rows from uploaded document.
        Returns (raw_text, tabular_records_if_any)
        """
        tabular_records: List[Dict[str, Any]] = []
        raw_text = ""

        try:
            if ext == ".txt":
                try:
                    raw_text = file_bytes.decode("utf-8")
                except UnicodeDecodeError:
                    raw_text = file_bytes.decode("latin-1", errors="replace")

            elif ext == ".pdf":
                raw_text = self._extract_pdf(file_bytes)

            elif ext == ".docx":
                raw_text = self._extract_docx(file_bytes)

            elif ext == ".pptx":
                raw_text = self._extract_pptx(file_bytes)

            elif ext == ".csv":
                raw_text, tabular_records = self._extract_csv(file_bytes)

            elif ext == ".xlsx":
                raw_text, tabular_records = self._extract_xlsx(file_bytes)

            elif ext in (".jpg", ".jpeg", ".png"):
                raw_text = self._extract_image_ocr(file_bytes, ext, filename)

        except Exception as e:
            logger.error(f"Error extracting content from {filename} ({ext}): {e}", exc_info=True)
            raise ValueError(f"Failed to process {filename}: {str(e)}")

        return raw_text, tabular_records

    def _extract_pdf(self, file_bytes: bytes) -> str:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        pages_text = []
        for i, page in enumerate(reader.pages):
            txt = page.extract_text() or ""
            pages_text.append(txt)
        combined = "\n".join(pages_text).strip()

        # If combined text is sparse/scanned, attempt OCR if available
        if len(combined) < 50:
            logger.info("PDF text density low, attempting image/scanned OCR fallback...")
            ocr_text = self._extract_pdf_ocr(reader)
            if ocr_text.strip():
                return ocr_text
        return combined

    def _extract_pdf_ocr(self, reader) -> str:
        try:
            ocr_service = get_ocr_service()
            all_ocr = []
            for page in reader.pages:
                for img_obj in getattr(page, "images", []):
                    # Save temporary image for OCR
                    with io.BytesIO(img_obj.data) as img_stream:
                        from PIL import Image
                        temp_img = Image.open(img_stream)
                        # Preprocess and OCR
                        import pytesseract
                        text = pytesseract.image_to_string(temp_img.convert("L"))
                        if text:
                            all_ocr.append(text)
            return "\n".join(all_ocr)
        except Exception as e:
            logger.warning(f"PDF OCR extraction fallback failed: {e}")
            return ""

    def _extract_docx(self, file_bytes: bytes) -> str:
        import docx
        doc = docx.Document(io.BytesIO(file_bytes))
        lines = []
        for p in doc.paragraphs:
            if p.text.strip():
                lines.append(p.text)
        for table in doc.tables:
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if cells:
                    lines.append(" | ".join(cells))
        return "\n".join(lines)

    def _extract_pptx(self, file_bytes: bytes) -> str:
        from pptx import Presentation
        prs = Presentation(io.BytesIO(file_bytes))
        lines = []
        for slide_idx, slide in enumerate(prs.slides, 1):
            slide_lines = []
            for shape in slide.shapes:
                if shape.has_text_frame:
                    for paragraph in shape.text_frame.paragraphs:
                        if paragraph.text.strip():
                            slide_lines.append(paragraph.text.strip())
            if slide_lines:
                lines.append(f"--- Slide {slide_idx} ---")
                lines.extend(slide_lines)
        return "\n".join(lines)

    def _extract_csv(self, file_bytes: bytes) -> Tuple[str, List[Dict[str, Any]]]:
        try:
            content = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            content = file_bytes.decode("latin-1", errors="replace")

        reader = csv.reader(io.StringIO(content))
        rows = list(reader)
        if not rows:
            return "", []

        # Check if first row is header
        first_row = [c.strip().lower() for c in rows[0]]
        has_question_col = any("question" in c for c in first_row)

        if has_question_col:
            headers = [c.strip().lower() for c in rows[0]]
            records = []
            for row in rows[1:]:
                if not any(row):
                    continue
                record = {}
                for h, val in zip(headers, row):
                    record[h] = val.strip()
                records.append(record)
            return content, records
        return content, []

    def _extract_xlsx(self, file_bytes: bytes) -> Tuple[str, List[Dict[str, Any]]]:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        sheet = wb.active
        rows = []
        for row in sheet.iter_rows(values_only=True):
            if any(row):
                rows.append([str(c).strip() if c is not None else "" for c in row])
        if not rows:
            return "", []

        first_row = [c.lower() for c in rows[0]]
        has_question_col = any("question" in c for c in first_row)
        if has_question_col:
            headers = first_row
            records = []
            for r in rows[1:]:
                if not any(r):
                    continue
                record = {}
                for h, val in zip(headers, r):
                    record[h] = val
                records.append(record)
            text_rep = "\n".join(["\t".join(r) for r in rows])
            return text_rep, records
        
        text_rep = "\n".join(["\t".join(r) for r in rows])
        return text_rep, []

    def _extract_image_ocr(self, file_bytes: bytes, ext: str, filename: str) -> str:
        valid, err, _ = validate_image_file(file_bytes, filename)
        if not valid:
            raise ValueError(f"Invalid image file: {err}")
        
        # Run OCR
        try:
            import pytesseract
            from PIL import Image
            with Image.open(io.BytesIO(file_bytes)) as img:
                grayscale = img.convert("L")
                text = pytesseract.image_to_string(grayscale)
                return text.strip()
        except Exception as e:
            logger.warning(f"Image OCR failed: {e}")
            return ""

    def detect_subject(self, text: str, records: Optional[List[Dict[str, Any]]] = None) -> Optional[str]:
        """Detect subject from headers or known keywords."""
        if records:
            for r in records:
                for k, v in r.items():
                    if "subject" in k and v.strip():
                        return v.strip()

        # Check explicit subject lines
        sub_match = re.search(r"(?:Subject|Course|Topic|Discipline)\s*[:=-]\s*([A-Za-z0-9\s&_-]+)", text, re.IGNORECASE)
        if sub_match:
            candidate = sub_match.group(1).strip()
            first_line = candidate.split("\n")[0].strip()
            if 2 <= len(first_line) <= 50:
                return first_line

        # Match against common subjects
        lower_text = text.lower()
        for subj in COMMON_SUBJECTS:
            pattern = r"\b" + re.escape(subj.lower()) + r"\b"
            if re.search(pattern, lower_text):
                return subj

        return None

    def parse_tabular_records(self, records: List[Dict[str, Any]], detected_subject: Optional[str] = None) -> List[ExtractedQuestion]:
        """Parses structured CSV/XLSX records with column headers into ExtractedQuestion models."""
        questions = []
        for idx, r in enumerate(records, 1):
            # Find question text column
            q_text = ""
            for k in r:
                if "question" in k:
                    q_text = r[k]
                    break
            if not q_text:
                continue

            # Identify options
            options = []
            for opt_key in ["option a", "option_a", "a", "option 1", "opt a", "opta"]:
                if opt_key in r and r[opt_key]:
                    options.append(ImportedOption(option_text=r[opt_key], is_correct=False))
            for opt_key in ["option b", "option_b", "b", "option 2", "opt b", "optb"]:
                if opt_key in r and r[opt_key]:
                    options.append(ImportedOption(option_text=r[opt_key], is_correct=False))
            for opt_key in ["option c", "option_c", "c", "option 3", "opt c", "optc"]:
                if opt_key in r and r[opt_key]:
                    options.append(ImportedOption(option_text=r[opt_key], is_correct=False))
            for opt_key in ["option d", "option_d", "d", "option 4", "opt d", "optd"]:
                if opt_key in r and r[opt_key]:
                    options.append(ImportedOption(option_text=r[opt_key], is_correct=False))

            # Identify answer column
            ans = None
            for k in r:
                if any(kw in k for kw in ["answer", "correct", "ans", "key"]):
                    ans_val = r[k].strip()
                    if ans_val:
                        ans = ans_val
                        break

            # Mark correct option if answer maps to an option
            if ans and options:
                ans_clean = ans.upper().strip()
                char_idx = {"A": 0, "B": 1, "C": 2, "D": 3}
                if ans_clean in char_idx and char_idx[ans_clean] < len(options):
                    options[char_idx[ans_clean]].is_correct = True
                else:
                    # Try text matching
                    for opt in options:
                        if opt.option_text.strip().lower() == ans.strip().lower():
                            opt.is_correct = True

            # Marks
            marks = 1.0
            for k in r:
                if "mark" in k:
                    try:
                        marks = float(re.sub(r"[^\d.]", "", r[k]))
                    except (ValueError, TypeError):
                        pass

            # Difficulty
            difficulty = "medium"
            for k in r:
                if "difficulty" in k and r[k].lower() in ("easy", "medium", "hard"):
                    difficulty = r[k].lower()

            # Subject
            subject = detected_subject
            for k in r:
                if "subject" in k and r[k].strip():
                    subject = r[k].strip()

            q_type = "MCQ" if len(options) >= 2 else "short_answer"

            questions.append(ExtractedQuestion(
                temp_id=f"temp-{idx}",
                question_text=q_text,
                question_type=q_type,
                options=options,
                correct_answer=ans,
                subject=subject,
                difficulty=difficulty,
                marks=marks,
                negative_marks=0.0
            ))
        return questions

    def parse_text_into_questions(self, raw_text: str, detected_subject: Optional[str] = None) -> List[ExtractedQuestion]:
        """
        Parses free-form or semi-structured text into ExtractedQuestion items.
        Recognizes question numbering, option letters, answers, marks, and true/false types.
        """
        if not raw_text or not raw_text.strip():
            return []

        # Split into lines
        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        if not lines:
            return []

        # Regex for Question header: e.g. "1.", "1)", "Q1.", "Question 1:", "1 -", "[1]"
        q_start_regex = re.compile(
            r"^(?:(?:Q|Question)\s*(\d+)[\.:\)\-]|(?:\[(\d+)\])|(?:(\d+)[\.\)\-]))\s*(.*)$",
            re.IGNORECASE
        )

        # Regex for Option: e.g. "A.", "A)", "(A)", "[A]", "a.", "a)"
        opt_start_regex = re.compile(
            r"^(?:(?:\(([A-Da-d])\))|(?:\[([A-Da-d])\])|(?:([A-Da-d])[\.\)\-]))\s*(.*)$"
        )

        # Regex for Answer indicator
        ans_regex = re.compile(
            r"^(?:(?:Correct\s*Answer|Answer|Ans|Key)\s*[:=-])\s*(.*)$",
            re.IGNORECASE
        )

        # Regex for Marks indicator
        marks_regex = re.compile(
            r"(?:\[|\()(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?)(?:\]|\))|(?:Marks?\s*[:=-]\s*(\d+(?:\.\d+)?))",
            re.IGNORECASE
        )

        blocks: List[Dict[str, Any]] = []
        current_block: Optional[Dict[str, Any]] = None

        for line in lines:
            # Check if line is question header
            q_match = q_start_regex.match(line)
            if q_match:
                if current_block and current_block.get("text"):
                    blocks.append(current_block)
                
                num = q_match.group(1) or q_match.group(2) or q_match.group(3)
                rest_of_text = q_match.group(4).strip()
                current_block = {
                    "num": num,
                    "text": rest_of_text,
                    "options": [],
                    "answer": None,
                    "marks": None,
                    "difficulty": "medium",
                    "model_answer": None
                }
                continue

            if not current_block:
                # Still in document header or intro lines
                continue

            # Check if line contains answer
            ans_match = ans_regex.match(line)
            if ans_match:
                ans_str = ans_match.group(1).strip()
                current_block["answer"] = ans_str
                continue

            # Check if line starts an option
            opt_match = opt_start_regex.match(line)
            if opt_match:
                letter = (opt_match.group(1) or opt_match.group(2) or opt_match.group(3)).upper()
                opt_txt = opt_match.group(4).strip()
                current_block["options"].append({"letter": letter, "text": opt_txt})
                continue

            # Check if line contains explanation or model answer
            if re.match(r"^(?:Explanation|Model Answer|Expected Answer)\s*[:=-]", line, re.IGNORECASE):
                expl = re.sub(r"^(?:Explanation|Model Answer|Expected Answer)\s*[:=-]\s*", "", line, flags=re.IGNORECASE)
                current_block["model_answer"] = expl
                continue

            # Append to either current option or question text
            if current_block["options"]:
                # Append to last option text
                current_block["options"][-1]["text"] += " " + line
            else:
                # Append to question text
                current_block["text"] += " " + line

        if current_block and current_block.get("text"):
            blocks.append(current_block)

        # Process blocks into ExtractedQuestion models
        extracted: List[ExtractedQuestion] = []
        for idx, b in enumerate(blocks, 1):
            q_text = b["text"].strip()
            # Extract marks from question text if present
            marks = 1.0
            m_match = marks_regex.search(q_text)
            if m_match:
                val = m_match.group(1) or m_match.group(2)
                try:
                    marks = float(val)
                except (ValueError, TypeError):
                    pass
                # Clean marks notation from question text
                q_text = marks_regex.sub("", q_text).strip()

            options_list: List[ImportedOption] = []
            detected_answer = b.get("answer")

            # Check for True/False question
            is_tf = False
            if "true or false" in q_text.lower() or "true/false" in q_text.lower():
                is_tf = True

            raw_opts = b.get("options", [])
            if raw_opts:
                for opt in raw_opts:
                    opt_text = opt["text"].strip()
                    opt_letter = opt["letter"].upper()
                    is_corr = False
                    if detected_answer:
                        # Normalize detected answer
                        norm_ans = detected_answer.strip().upper()
                        # Direct letter match: e.g. "B" or "(B)" or "B)"
                        clean_ans_letter = re.sub(r"[^\w]", "", norm_ans)
                        if clean_ans_letter == opt_letter:
                            is_corr = True
                        elif opt_text.lower() == detected_answer.lower():
                            is_corr = True
                    options_list.append(ImportedOption(option_text=opt_text, is_correct=is_corr))
            elif is_tf:
                corr_t = detected_answer and detected_answer.lower() in ("true", "t")
                corr_f = detected_answer and detected_answer.lower() in ("false", "f")
                options_list = [
                    ImportedOption(option_text="True", is_correct=bool(corr_t)),
                    ImportedOption(option_text="False", is_correct=bool(corr_f))
                ]

            # Determine Question Type
            if len(options_list) >= 2:
                q_type = "MCQ"
                # Check if multiple options are marked correct
                if sum(1 for o in options_list if o.is_correct) > 1:
                    q_type = "multi_select"
            else:
                if marks >= 5.0 or "explain" in q_text.lower() or "describe" in q_text.lower():
                    q_type = "long_answer"
                else:
                    q_type = "short_answer"

            extracted.append(ExtractedQuestion(
                temp_id=f"temp-{idx}",
                question_text=q_text,
                question_type=q_type,
                options=options_list,
                correct_answer=detected_answer,
                subject=detected_subject,
                difficulty=b.get("difficulty", "medium"),
                marks=marks,
                negative_marks=0.0,
                model_answer=b.get("model_answer"),
                expected_answer=None
            ))

        return extracted

    def detect_duplicates(
        self,
        extracted_questions: List[ExtractedQuestion],
        existing_questions: List[Tuple[int, str]]
    ) -> int:
        """
        Detects duplicates by comparing normalized question text against existing questions.
        existing_questions is a list of (id, question_text) tuples.
        Modifies extracted_questions in-place and returns total duplicate count.
        """
        dup_count = 0
        for eq in extracted_questions:
            eq_norm = normalize_text_for_comparison(eq.question_text)
            for ex_id, ex_text in existing_questions:
                ex_norm = normalize_text_for_comparison(ex_text)
                # Check exact normalized match
                if eq_norm == ex_norm:
                    eq.is_duplicate = True
                    eq.duplicate_reason = f"Identical to existing Question #{ex_id}: '{ex_text[:60]}...'"
                    dup_count += 1
                    break
                # Check high token similarity
                sim = calculate_token_similarity(eq.question_text, ex_text)
                if sim >= 0.85:
                    eq.is_duplicate = True
                    eq.duplicate_reason = f"High similarity ({int(sim*100)}%) with Question #{ex_id}: '{ex_text[:60]}...'"
                    dup_count += 1
                    break
        return dup_count

document_parser = DocumentParserService()
