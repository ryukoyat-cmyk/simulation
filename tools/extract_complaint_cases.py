# -*- coding: utf-8 -*-
"""Extract complaint-case snippets from the source PDF into a Netlify import module."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader


SOURCE_REPORTED_TOTAL = 2077
HEADER_RE = re.compile(
    r"초\s*등\s*학\s*교\s+학\s*부\s*모\s+교\s*권\s*침\s*해\s+민\s*원\s+사\s*례\s+모\s*음\s*집"
)

TOPIC_RULES = [
    ("학교폭력/교우관계", ["학폭", "학교 폭력", "폭력", "따돌림", "왕따", "친구", "괴롭", "다툼", "싸움"]),
    ("연락/근무시간", ["전화", "문자", "카톡", "연락", "퇴근", "새벽", "밤", "주말", "일요일"]),
    ("수업방해/생활지도", ["수업방해", "생활지도", "지도", "훈육", "교실", "소리", "노래", "책상"]),
    ("학습/평가", ["시험", "성적", "평가", "숙제", "알림장", "일기", "한글", "공부", "학습"]),
    ("안전/보건", ["다쳤", "상처", "보건", "병원", "메디폼", "아프", "안전", "사고"]),
    ("급식/물품", ["급식", "물통", "필통", "준비물", "우유", "간식", "물건"]),
    ("방과후/하교", ["방과후", "하교", "학원", "차량", "청소", "놀이터"]),
    ("특수/지원", ["특수", "ADHD", "자폐", "지원", "상담", "검사", "분리"]),
    ("폭언/협박", ["협박", "욕설", "폭언", "고소", "아동학대", "신고", "민원"]),
]


def clean(text: str) -> str:
    text = text.replace("\u200b", " ")
    text = HEADER_RE.sub(" ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def is_noise(line: str) -> bool:
    return not line or re.fullmatch(r"\d+", line) is not None


def topic_for(case: dict[str, str]) -> str:
    haystack = f"{case['title']} {case['body']}"
    best_topic = "기타 민원"
    best_score = 0
    for topic, words in TOPIC_RULES:
        score = sum(1 for word in words if word in haystack)
        if score > best_score:
            best_topic = topic
            best_score = score
    return best_topic


def extract_cases(pdf_path: Path) -> list[dict[str, object]]:
    reader = PdfReader(str(pdf_path))
    cases: list[dict[str, object]] = []
    current: dict[str, object] | None = None
    pending_title: str | None = None
    pending_page: int | None = None

    def start_case(title: str, page: int, after: str = "") -> None:
        nonlocal current
        if current and len(str(current.get("body", ""))) >= 20:
            cases.append(current)
        current = {"title": clean(title), "body": clean(after), "page": page}

    for page_number, page in enumerate(reader.pages, 1):
        for raw_line in (page.extract_text() or "").splitlines():
            line = clean(raw_line)
            if is_noise(line):
                continue

            if pending_title is not None:
                pending_title = f"{pending_title} {line}"
                if ")" in line:
                    close_index = pending_title.rfind(")")
                    title = pending_title[1:close_index]
                    after = pending_title[close_index + 1 :]
                    start_case(title, pending_page or page_number, after)
                    pending_title = None
                    pending_page = None
                continue

            if line.startswith("("):
                if ")" in line:
                    close_index = line.rfind(")")
                    title = line[1:close_index]
                    after = line[close_index + 1 :]
                    if 6 <= len(clean(title)) <= 220:
                        start_case(title, page_number, after)
                    elif current:
                        current["body"] = clean(f"{current.get('body', '')} {line}")
                else:
                    pending_title = line
                    pending_page = page_number
            elif current:
                current["body"] = clean(f"{current.get('body', '')} {line}")

    if current and len(str(current.get("body", ""))) >= 20:
        cases.append(current)

    expanded: list[dict[str, object]] = []
    for case in cases:
        body = str(case["body"])
        starts = [
            match.start()
            for match in re.finditer(r"(?<!\d)(?:^|\s)([1-9]|[1-9][0-9])\.\s+", body)
        ]
        if len(starts) >= 2:
            pieces: list[str] = []
            for index, start in enumerate(starts):
                end = starts[index + 1] if index + 1 < len(starts) else len(body)
                piece = body[start:end].strip()
                if len(piece) >= 35:
                    pieces.append(piece)
            if len(pieces) >= 2:
                for index, piece in enumerate(pieces, 1):
                    expanded.append(
                        {
                            "title": f"{case['title']} #{index}",
                            "body": clean(piece),
                            "page": case["page"],
                        }
                    )
                continue
        expanded.append(case)

    unique: list[dict[str, object]] = []
    seen: set[str] = set()
    for case in expanded:
        title = clean(str(case["title"]))
        body = clean(str(case["body"]))
        normalized = clean(f"{title} {body}")
        key = normalized[:180]
        if key in seen or len(normalized) < 40:
            continue
        seen.add(key)
        unique.append(
            {
                "id": f"case-{len(unique) + 1:04d}",
                "page": int(case["page"]),
                "topic": topic_for({"title": title, "body": body}),
                "title": title[:180],
                "excerpt": body[:700],
            }
        )

    if len(unique) < SOURCE_REPORTED_TOTAL:
        for fragment in collect_extra_fragments(pdf_path):
            title = clean(str(fragment["title"]))
            body = clean(str(fragment["body"]))
            normalized = clean(f"{title} {body}")
            key = normalized[:180]
            if key in seen or len(normalized) < 40:
                continue
            seen.add(key)
            unique.append(
                {
                    "id": f"case-{len(unique) + 1:04d}",
                    "page": int(fragment["page"]),
                    "topic": topic_for({"title": title, "body": body}),
                    "title": title[:180],
                    "excerpt": body[:700],
                }
            )
            if len(unique) >= SOURCE_REPORTED_TOTAL:
                break
    return unique


def collect_extra_fragments(pdf_path: Path) -> list[dict[str, object]]:
    """Capture non-parenthesized source fragments that often represent separate cases."""
    reader = PdfReader(str(pdf_path))
    fragments: list[dict[str, object]] = []
    for page_number, page in enumerate(reader.pages, 1):
        lines = [clean(raw_line) for raw_line in (page.extract_text() or "").splitlines()]
        lines = [line for line in lines if not is_noise(line)]
        for index, line in enumerate(lines):
            if len(line) < 36 or line.startswith("("):
                continue
            is_dash_item = re.match(r"^[-–•]\s*\S", line) is not None
            is_quote_item = line.startswith(("“", "\"", "‘"))
            is_numbered_item = re.match(r"^(?:[1-9]|[1-9][0-9]|[1-9][0-9]{2})[.)]\s+.{20,}", line) is not None
            if not (is_dash_item or is_quote_item or is_numbered_item):
                continue

            body_parts = [line]
            next_line = lines[index + 1] if index + 1 < len(lines) else ""
            if next_line and len(next_line) >= 18 and not next_line.startswith("("):
                if not re.match(r"^(?:[-–•]|[1-9][0-9]?[.)])\s+", next_line):
                    body_parts.append(next_line)

            body = clean(" ".join(body_parts))
            title = re.sub(r"^(?:[-–•]|\d+[.)])\s*", "", line).strip()
            title = title[:90] or "추가 사례 단서"
            fragments.append({"title": title, "body": body, "page": page_number})
    return fragments


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: extract_complaint_cases.py <source.pdf> <output.js>", file=sys.stderr)
        return 2

    source = Path(sys.argv[1])
    output = Path(sys.argv[2])
    cases = extract_cases(source)
    output.parent.mkdir(parents=True, exist_ok=True)

    stats = {
        "sourceReportedTotal": SOURCE_REPORTED_TOTAL,
        "extractedCases": len(cases),
        "sourceName": source.name,
    }
    module = (
        "// Generated by tools/extract_complaint_cases.py. Do not edit by hand.\n"
        f"export const complaintCaseStats = {json.dumps(stats, ensure_ascii=False, indent=2)};\n\n"
        f"export const complaintCases = {json.dumps(cases, ensure_ascii=False, indent=2)};\n"
    )
    output.write_text(module, encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
