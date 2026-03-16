"""Document summarization helpers for processing long texts."""

from __future__ import annotations

import json
import re
import sys
import textwrap


def chunk_text(text: str, max_chars: int = 3000) -> list[str]:
    """Split text into chunks at paragraph boundaries."""
    paragraphs = re.split(r"\n\s*\n", text)
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if current_len + len(para) > max_chars and current:
            chunks.append("\n\n".join(current))
            current = []
            current_len = 0
        current.append(para)
        current_len += len(para)

    if current:
        chunks.append("\n\n".join(current))

    return chunks


def extract_action_items(text: str) -> list[str]:
    """Extract lines that look like action items or tasks from text.

    Looks for patterns like:
    - "TODO: ...", "Action: ...", "[ ] ..."
    - Lines starting with a person's name followed by "will" / "to" / "should"
    - Bullet points containing deadlines or assignments
    """
    items: list[str] = []
    patterns = [
        r"(?i)^[\s\-\*]*(?:TODO|action|task|follow[- ]?up)\s*[:—\-]\s*(.+)",
        r"(?i)^[\s\-\*]*\[[\s\]]*\]\s*(.+)",
        r"(?i)^[\s\-\*]*(?:\w+)\s+(?:will|should|to|needs? to|must)\s+(.+)",
    ]

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        for pattern in patterns:
            match = re.match(pattern, line)
            if match:
                items.append(line.lstrip("-* "))
                break

    return items


def word_count(text: str) -> dict:
    """Return basic stats about the text."""
    words = text.split()
    sentences = re.split(r"[.!?]+", text)
    paragraphs = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
    return {
        "words": len(words),
        "sentences": len([s for s in sentences if s.strip()]),
        "paragraphs": len(paragraphs),
        "characters": len(text),
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: summarize.py <command> [file_path]")
        print("Commands: stats, chunks, actions")
        sys.exit(1)

    cmd = sys.argv[1]
    file_path = sys.argv[2] if len(sys.argv) > 2 else None

    if file_path:
        with open(file_path) as f:
            text = f.read()
    else:
        text = sys.stdin.read()

    if cmd == "stats":
        print(json.dumps(word_count(text), indent=2))
    elif cmd == "chunks":
        max_chars = int(sys.argv[3]) if len(sys.argv) > 3 else 3000
        parts = chunk_text(text, max_chars)
        print(f"Split into {len(parts)} chunks:")
        for i, chunk in enumerate(parts, 1):
            print(f"\n--- Chunk {i} ({len(chunk)} chars) ---")
            print(textwrap.shorten(chunk, width=200, placeholder="..."))
    elif cmd == "actions":
        items = extract_action_items(text)
        if items:
            for item in items:
                print(f"- {item}")
        else:
            print("No action items found.")
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
