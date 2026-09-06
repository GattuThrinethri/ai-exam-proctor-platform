import os
import re
import json
import logging
from typing import Optional, Tuple, Dict, Any, List, Set
from app.config import settings
from app.models.question import QuestionBank, QuestionType
from app.models.answer import Answer

logger = logging.getLogger("subjective_evaluator")

STOP_WORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't",
    "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
    "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
    "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
    "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i",
    "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's",
    "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
    "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought",
    "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she",
    "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
    "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
    "they've", "this", "those", "through", "to", "too", "under", "until", "up",
    "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
    "weren't", "what", "what's", "when", "when's", "where", "where's", "which",
    "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
    "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
    "yourself", "yourselves"
}

def extract_meaningful_tokens(text: Optional[str]) -> List[str]:
    """Extract content words by lowercasing, stripping punctuation, and removing common stop words."""
    if not text:
        return []
    words = re.findall(r"\b[a-zA-Z0-9_-]{2,}\b", text.lower())
    return [w for w in words if w not in STOP_WORDS]

def evaluate_heuristic_fallback(
    question: QuestionBank,
    student_text: str,
) -> Tuple[float, str, Dict[str, Any]]:
    """
    Deterministic heuristic fallback for subjective answer evaluation.
    Evaluates concept coverage, keyword overlap, and length completeness.
    Guarantees:
    - Bounded score between 0.0 and question.marks
    - Generates structured feedback (matched concepts, missed concepts)
    - Distinguishes evaluation method as 'heuristic_fallback'
    """
    marks = float(question.marks)
    norm_student = student_text.strip()

    if not norm_student:
        return 0.0, "No answer provided.", {
            "evaluation_method": "heuristic_fallback",
            "matched_points": [],
            "missed_points": ["No answer submitted"],
            "summary": "Student did not submit an answer."
        }

    reference_text = f"{question.model_answer or ''} {question.expected_answer or ''}".strip()
    if not reference_text:
        # Fall back to evaluating question keywords if no model answer provided
        reference_text = question.question_text

    ref_tokens = set(extract_meaningful_tokens(reference_text))
    student_tokens = set(extract_meaningful_tokens(norm_student))

    if not ref_tokens:
        # If no reference tokens exist, award 50% for non-empty answer as neutral fallback
        return round(marks * 0.5, 2), "Answer submitted; evaluated without reference answer.", {
            "evaluation_method": "heuristic_fallback",
            "matched_points": ["Submitted response"],
            "missed_points": [],
            "summary": "Evaluation performed without model answer reference."
        }

    # Concept overlap calculations
    matched = ref_tokens.intersection(student_tokens)
    missed = ref_tokens.difference(student_tokens)

    # Overlap ratio relative to reference concept density
    recall = len(matched) / len(ref_tokens)

    # Word count completeness factor (penalizes single-word answers for multi-mark questions)
    word_count = len(norm_student.split())
    min_expected_words = 5 if question.question_type == QuestionType.SHORT_ANSWER else 15
    completeness = min(1.0, word_count / min_expected_words)

    # Composite score: 80% keyword recall + 20% completeness
    composite_ratio = (recall * 0.8) + (completeness * 0.2)
    calculated_score = round(composite_ratio * marks, 2)

    # Strict clamping
    bounded_score = max(0.0, min(marks, calculated_score))

    matched_sample = sorted(list(matched))[:10]
    missed_sample = sorted(list(missed))[:10]

    justification = (
        f"Heuristic evaluation identified {len(matched)} of {len(ref_tokens)} key concept terms "
        f"({int(recall * 100)}% concept coverage)."
    )

    feedback = {
        "evaluation_method": "heuristic_fallback",
        "matched_points": matched_sample,
        "missed_points": missed_sample,
        "concept_coverage_percent": round(recall * 100, 1),
        "word_count": word_count,
        "summary": justification,
    }

    return bounded_score, justification, feedback


async def evaluate_with_llm(
    question: QuestionBank,
    student_text: str,
) -> Tuple[float, str, Dict[str, Any]]:
    """
    Evaluates subjective answer using LLM API if key is available.
    """
    import httpx

    api_key = settings.OPENAI_API_KEY
    if not api_key:
        raise ValueError("No LLM API key configured")

    prompt = (
        f"You are an academic examiner evaluating a student's answer.\n\n"
        f"Subject: {question.subject}\n"
        f"Question: {question.question_text}\n"
        f"Maximum Marks: {question.marks}\n"
        f"Model Answer: {question.model_answer or question.expected_answer or 'None provided'}\n\n"
        f"Student's Answer:\n\"{student_text}\"\n\n"
        f"Evaluate the student's response on correctness, key concepts, and completeness.\n"
        f"Respond ONLY with a JSON object in this exact schema:\n"
        f"{{\n"
        f'  "score": <float between 0 and {question.marks}>,\n'
        f'  "justification": "<brief explanation of the grade>",\n'
        f'  "matched_points": ["<concept 1>", "<concept 2>"],\n'
        f'  "missed_points": ["<missed concept 1>"]\n'
        f"}}"
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": settings.OPENAI_MODEL or "gpt-4o",
        "messages": [
            {"role": "system", "content": "You are an objective academic evaluator returning only valid JSON."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"}
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        result = json.loads(content)

        score = float(result.get("score", 0.0))
        bounded_score = max(0.0, min(float(question.marks), score))
        justification = result.get("justification", "Evaluated by AI.")
        feedback = {
            "evaluation_method": "llm",
            "matched_points": result.get("matched_points", []),
            "missed_points": result.get("missed_points", []),
            "summary": justification,
        }
        return bounded_score, justification, feedback


async def evaluate_subjective(
    question: QuestionBank,
    answer: Optional[Answer]
) -> Tuple[float, str, Dict[str, Any]]:
    """
    Orchestrates subjective answer evaluation:
    1. Extracts student text (OCR text for image upload, answer_text for text questions).
    2. Attempts LLM evaluation if configured.
    3. Seamlessly falls back to deterministic heuristic evaluation if LLM fails or is unconfigured.
    """
    if answer is None:
        return 0.0, "No answer submitted.", {
            "evaluation_method": "unanswered",
            "matched_points": [],
            "missed_points": ["No answer submitted"],
            "summary": "Student did not submit an answer."
        }

    # Extract text from answer
    student_text = ""
    if answer.ocr_text and answer.ocr_text.strip():
        student_text = answer.ocr_text.strip()
    elif answer.answer_text and answer.answer_text.strip():
        student_text = answer.answer_text.strip()

    if not student_text:
        return 0.0, "No content provided in submitted answer.", {
            "evaluation_method": "unanswered",
            "matched_points": [],
            "missed_points": ["No content provided"],
            "summary": "Answer was submitted without readable content."
        }

    # Try LLM if configured
    if settings.OPENAI_API_KEY:
        try:
            return await evaluate_with_llm(question, student_text)
        except Exception as e:
            logger.warning(f"LLM subjective evaluation failed ({e}); falling back to heuristic evaluation.")

    # Heuristic Fallback
    return evaluate_heuristic_fallback(question, student_text)
