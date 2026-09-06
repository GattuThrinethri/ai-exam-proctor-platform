import logging
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.result import Result
from app.models.session import ExamSession, SessionStatus

logger = logging.getLogger("percentile_service")


async def calculate_exam_percentiles(exam_id: int, db: AsyncSession) -> None:
    """
    Computes authoritative percentile ranks for all completed candidate results of an exam.
    Formula: Percentile = (Number of candidates with score <= candidate_score / Total candidate count) * 100
    - Only completed sessions (SUBMITTED or TIMED_OUT) are included.
    - Single candidate exam distribution returns 100.0%.
    - Ties are handled consistently using the cumulative distribution function.
    """
    stmt = (
        select(Result, ExamSession)
        .join(ExamSession, Result.session_id == ExamSession.id)
        .where(
            ExamSession.exam_id == exam_id,
            ExamSession.status.in_([SessionStatus.SUBMITTED, SessionStatus.TIMED_OUT])
        )
    )
    res = await db.execute(stmt)
    rows = res.all()

    if not rows:
        return

    total_candidates = len(rows)

    if total_candidates == 1:
        single_result, _ = rows[0]
        single_result.percentile = 100.0
        await db.commit()
        return

    # Extract all candidate scores
    scores = [result_obj.total_score for result_obj, _ in rows]

    for result_obj, _ in rows:
        cand_score = result_obj.total_score
        # Count candidates with score <= cand_score
        count_less_equal = sum(1 for s in scores if s <= cand_score)
        pct = round((count_less_equal / total_candidates) * 100.0, 2)
        result_obj.percentile = pct

    await db.commit()
    logger.info(f"Updated percentile ranks for {total_candidates} candidates in exam {exam_id}")


def compute_single_percentile(candidate_score: float, all_scores: List[float]) -> float:
    """
    Authoritative single candidate percentile computation against a given score distribution.
    """
    if not all_scores:
        return 100.0
    if len(all_scores) == 1:
        return 100.0

    count_less_equal = sum(1 for s in all_scores if s <= candidate_score)
    return round((count_less_equal / len(all_scores)) * 100.0, 2)
