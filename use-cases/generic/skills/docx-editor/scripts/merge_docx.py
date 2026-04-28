#!/usr/bin/env python3
"""Merge multiple Word documents (.docx) into one."""

import json
import sys
import os
import argparse


def ensure_dependencies():
    try:
        import docx
    except ImportError:
        os.system("pip install python-docx")


def merge_documents(file_paths, output_path, page_break_between=True):
    """Merge multiple .docx files into a single document."""
    ensure_dependencies()
    from docx import Document
    from docx.oxml.ns import qn

    if not file_paths:
        return {"error": "No files provided"}

    # Use the first document as the base
    merged = Document(file_paths[0])

    for file_path in file_paths[1:]:
        if not os.path.exists(file_path):
            return {"error": f"File not found: {file_path}"}

        if page_break_between:
            merged.add_page_break()

        sub_doc = Document(file_path)

        for element in sub_doc.element.body:
            merged.element.body.append(element)

    os.makedirs(os.path.dirname(output_path) or '/tmp', exist_ok=True)
    merged.save(output_path)

    return {
        "status": "success",
        "output_path": output_path,
        "files_merged": len(file_paths),
        "source_files": file_paths,
    }


def main():
    parser = argparse.ArgumentParser(description="Merge multiple .docx files into one")
    parser.add_argument('--files', nargs='+', required=True, help="Input .docx file paths")
    parser.add_argument('--output', required=True, help="Output .docx file path")
    parser.add_argument('--page_break_between', type=lambda x: x.lower() == 'true',
                        default=True, help="Insert page break between documents (default: true)")

    args = parser.parse_args()

    result = merge_documents(args.files, args.output, args.page_break_between)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
