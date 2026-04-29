---
name: docx-editor
description: Create, read, edit, and manipulate Word documents (.docx) with full formatting, tables, images, headers, footers, and template support
enabled: true
---

## Instructions

When the user asks you to create, read, edit, or manipulate a Word document (.docx), follow the workflows below.

### 1. Determine the Operation

| User Intent | Operation | Script |
|-------------|-----------|--------|
| Create a new document | **Create** | `scripts/create_docx.py` |
| Read / extract text from a .docx | **Read** | `scripts/read_docx.py` |
| Edit an existing document | **Edit** | `scripts/edit_docx.py` |
| Merge multiple documents | **Merge** | `scripts/merge_docx.py` |
| Convert .docx to other formats | **Convert** | `scripts/convert_docx.py` |
| Apply or use a template | **Template** | `scripts/template_fill.py` |
| Inspect document structure/metadata | **Inspect** | `scripts/inspect_docx.py` |

### 2. Creating Documents

Use `scripts/create_docx.py` to build a new .docx from a JSON content specification.

**Content specification format:**

```json
{
  "output_path": "/tmp/output.docx",
  "metadata": {
    "title": "Document Title",
    "author": "Author Name",
    "subject": "Subject",
    "keywords": "keyword1, keyword2"
  },
  "page_setup": {
    "orientation": "portrait",
    "top_margin": 1.0,
    "bottom_margin": 1.0,
    "left_margin": 1.25,
    "right_margin": 1.25
  },
  "styles": {
    "custom_styles": [
      {
        "name": "CustomHeading",
        "base": "Heading 1",
        "font_name": "Calibri",
        "font_size": 16,
        "bold": true,
        "color": "#2E74B5"
      }
    ]
  },
  "content": [
    {
      "type": "heading",
      "level": 1,
      "text": "Section Title"
    },
    {
      "type": "paragraph",
      "text": "Body text content here.",
      "style": "Normal",
      "bold": false,
      "italic": false,
      "alignment": "left"
    },
    {
      "type": "paragraph",
      "text": "Text with **bold** and *italic* inline formatting.",
      "parse_markdown": true
    },
    {
      "type": "table",
      "headers": ["Column A", "Column B", "Column C"],
      "rows": [
        ["Row 1A", "Row 1B", "Row 1C"],
        ["Row 2A", "Row 2B", "Row 2C"]
      ],
      "style": "Table Grid",
      "header_bg_color": "#2E74B5",
      "header_font_color": "#FFFFFF"
    },
    {
      "type": "image",
      "path": "/tmp/chart.png",
      "width_inches": 5.0,
      "caption": "Figure 1: Chart description"
    },
    {
      "type": "list",
      "style": "bullet",
      "items": ["First item", "Second item", "Third item"]
    },
    {
      "type": "list",
      "style": "numbered",
      "items": ["Step one", "Step two", "Step three"]
    },
    {
      "type": "page_break"
    },
    {
      "type": "hyperlink",
      "text": "Click here",
      "url": "https://example.com"
    },
    {
      "type": "header",
      "text": "Document Header Text",
      "alignment": "center"
    },
    {
      "type": "footer",
      "text": "Page ",
      "include_page_number": true,
      "alignment": "center"
    }
  ]
}
```

**Guidelines for creating documents:**
- Build the JSON spec based on the user's request
- Use professional formatting defaults (Calibri 11pt, 1-inch margins) unless specified otherwise
- For reports or formal documents, include a title page, headers/footers, and page numbers
- For simple documents, keep the structure minimal
- Always save output to `/tmp/` directory
- After creating, provide the file path and offer to share via `file-sharing`

### 3. Reading Documents

Use `scripts/read_docx.py` to extract content from existing .docx files.

**Extraction modes:**

| Mode | Description | Use Case |
|------|-------------|----------|
| `text` | Plain text, all paragraphs | Quick content review |
| `structured` | JSON with styles, formatting, tables | Detailed analysis |
| `tables` | Extract only tables as JSON arrays | Data extraction |
| `metadata` | Document properties only | Quick inspection |
| `images` | Extract embedded images to /tmp | Image retrieval |

**Usage:**
```bash
python scripts/read_docx.py /tmp/input.docx --mode structured
```

**Guidelines for reading:**
- Default to `text` mode for summarization requests
- Use `structured` mode when the user needs formatting details
- Use `tables` mode when the user is looking for tabular data
- Extract images to `/tmp/docx_images/` when requested
- For very large documents, report page/section count first and ask if the user wants everything

### 4. Editing Documents

Use `scripts/edit_docx.py` to modify existing .docx files.

**Supported edit operations:**

```json
{
  "input_path": "/tmp/original.docx",
  "output_path": "/tmp/edited.docx",
  "operations": [
    {
      "action": "find_replace",
      "find": "old text",
      "replace": "new text",
      "match_case": true
    },
    {
      "action": "find_replace_regex",
      "pattern": "\\d{4}-\\d{2}-\\d{2}",
      "replace": "2025-01-01"
    },
    {
      "action": "append_paragraph",
      "text": "New paragraph at the end.",
      "style": "Normal"
    },
    {
      "action": "insert_paragraph",
      "after_text": "Insert after this text",
      "text": "Newly inserted paragraph.",
      "style": "Normal"
    },
    {
      "action": "delete_paragraph",
      "containing_text": "Delete the paragraph with this text"
    },
    {
      "action": "append_table",
      "headers": ["Col A", "Col B"],
      "rows": [["val1", "val2"]]
    },
    {
      "action": "insert_image",
      "image_path": "/tmp/new_image.png",
      "width_inches": 4.0,
      "after_text": "Insert image after this text"
    },
    {
      "action": "update_metadata",
      "title": "New Title",
      "author": "New Author"
    },
    {
      "action": "apply_style",
      "paragraph_containing": "Some text",
      "style": "Heading 1"
    },
    {
      "action": "set_font",
      "paragraph_containing": "Some text",
      "font_name": "Arial",
      "font_size": 14,
      "bold": true,
      "italic": false,
      "color": "#333333"
    },
    {
      "action": "update_header",
      "text": "New Header"
    },
    {
      "action": "update_footer",
      "text": "New Footer"
    }
  ]
}
```

**Guidelines for editing:**
- Always save to a **new file** by default to preserve the original
- Show the user what changes will be made before applying
- For find/replace, report how many occurrences were found and replaced
- Preserve all existing formatting that isn't being explicitly changed

### 5. Merging Documents

Use `scripts/merge_docx.py` to combine multiple .docx files into one.

```bash
python scripts/merge_docx.py --files /tmp/doc1.docx /tmp/doc2.docx /tmp/doc3.docx --output /tmp/merged.docx --page_break_between true
```

**Options:**
- `--page_break_between`: Insert page break between each source document (default: true)
- `--output`: Output file path
- `--files`: Space-separated list of input .docx files

**Guidelines:**
- Default to inserting page breaks between merged documents
- Warn the user if documents have conflicting styles or headers/footers
- Preserve formatting from each source document as much as possible

### 6. Converting Documents

Use `scripts/convert_docx.py` for format conversions.

**Supported conversions:**

| From | To | Method |
|------|----|--------|
| .docx | .pdf | via LibreOffice CLI or reportlab |
| .docx | .txt | Text extraction |
| .docx | .html | Structured conversion |
| .docx | .md | Markdown conversion |
| .md | .docx | Markdown to Word |
| .txt | .docx | Plain text to Word |
| .html | .docx | HTML to Word |

```bash
python scripts/convert_docx.py /tmp/input.docx --to pdf --output /tmp/output.pdf
python scripts/convert_docx.py /tmp/input.md --to docx --output /tmp/output.docx
```

**Guidelines:**
- For PDF conversion, prefer LibreOffice (`libreoffice --headless --convert-to pdf`) when available for best fidelity
- For markdown-to-docx, preserve heading levels, bold/italic, lists, and code blocks
- Warn the user about potential formatting loss in lossy conversions (e.g., docx → txt)

### 7. Template Filling

Use `scripts/template_fill.py` to fill placeholder values in a template .docx.

**Placeholders** use double-curly-brace syntax: `{{placeholder_name}}`

```bash
python scripts/template_fill.py /tmp/template.docx --values '{"name": "John", "date": "2025-06-01", "company": "Acme Corp"}' --output /tmp/filled.docx
```

**Guidelines:**
- Scan the template first to identify all placeholders
- Report any placeholders that don't have values provided
- Preserve all formatting around the placeholders
- Handle placeholders that may be split across multiple runs in the XML

### 8. Inspecting Documents

Use `scripts/inspect_docx.py` to get structural information about a document.

```bash
python scripts/inspect_docx.py /tmp/document.docx
```

**Returns:**
- Document metadata (title, author, created date, modified date)
- Page count estimate (based on section/paragraph count)
- Style inventory (all styles used)
- Table count and dimensions
- Image count
- Header/footer content
- Section count and page orientation
- Word count, paragraph count, character count

## Constraints

- All file operations are limited to the `/tmp` directory
- Maximum supported file size: 50 MB
- Images inserted must be PNG, JPEG, or GIF format
- Complex formatting (SmartArt, embedded charts, ActiveX controls) cannot be created from scratch but will be preserved when editing existing documents
- Track Changes / revision marks are read-only — they can be inspected but not programmatically accepted or rejected
- Password-protected documents cannot be opened
- Macros (.docm) are not supported — only .docx
- Font rendering depends on fonts available in the runtime environment

## Error Handling

- If a .docx file is corrupted or unreadable, report the error and suggest the user re-upload
- If a required library is missing, install it via `pip install python-docx` (or other needed packages)
- If LibreOffice is not available for PDF conversion, fall back to a Python-based approach and warn about potential fidelity differences
- If a find/replace operation finds zero matches, report this to the user rather than silently succeeding
- If the document contains unsupported features, preserve them untouched and inform the user

## Examples

**User**: "Create a project proposal document with a title page, executive summary, and timeline table"

Steps:
1. Build a JSON content spec with:
   - Title page (centered heading, author, date)
   - Page break
   - Executive Summary heading + paragraphs
   - Timeline table with columns: Phase, Description, Dates
2. Run `scripts/create_docx.py` with the spec
3. Return the file path and offer download via `file-sharing`

**User**: "Extract all the tables from this Word document"

Steps:
1. Run `scripts/read_docx.py /tmp/uploaded.docx --mode tables`
2. Format the extracted tables in chat
3. Optionally export as CSV via `code_interpreter`

**User**: "Replace all instances of '2024' with '2025' in this document"

Steps:
1. Run `scripts/edit_docx.py` with a `find_replace` operation
2. Report the number of replacements made
3. Return the path to the edited document

**User**: "Merge these three reports into one document"

Steps:
1. Run `scripts/merge_docx.py` with the three file paths
2. Insert page breaks between each document
3. Return the merged file path

**User**: "Convert this Word doc to PDF"

Steps:
1. Run `scripts/convert_docx.py /tmp/report.docx --to pdf`
2. Return the PDF file path

## Chaining

This skill works best when combined with:
- `code_interpreter` — generate charts/images to embed, or run data processing before document creation
- `data-analysis` — analyze data and produce tables or summaries to include in documents
- `document-summary` — summarize a .docx before forwarding it
- `rag-search` — retrieve knowledge base content to include in documents
- `file-sharing` — deliver generated .docx files to the user for download
- `email-draft` — create a document and then draft an email with it attached
- `spreadsheet-creator` — export table data to Excel, or import Excel data into a document
