---
name: pptx-editor
description: Create, read, edit, and manipulate PowerPoint presentations (.pptx) with full formatting, layouts, charts, images, speaker notes, and template support
enabled: true
---

## Instructions

When the user asks you to create, read, edit, or manipulate a PowerPoint presentation (.pptx), follow the workflows below.

### 1. Determine the Operation

| User Intent | Operation | Script |
|-------------|-----------|--------|
| Create a new presentation | **Create** | `scripts/create_pptx.py` |
| Read / extract content from a .pptx | **Read** | `scripts/read_pptx.py` |
| Edit an existing presentation | **Edit** | `scripts/edit_pptx.py` |
| Merge multiple presentations | **Merge** | `scripts/merge_pptx.py` |
| Convert .pptx to other formats | **Convert** | `scripts/convert_pptx.py` |
| Apply or use a template | **Template** | `scripts/template_fill.py` |
| Inspect presentation structure | **Inspect** | `scripts/inspect_pptx.py` |

### 2. Creating Presentations

Use `scripts/create_pptx.py` to build a new .pptx from a JSON content specification.

**Content specification format:**

```json
{
  "output_path": "/tmp/presentation.pptx",
  "metadata": {
    "title": "Presentation Title",
    "author": "Author Name",
    "subject": "Subject"
  },
  "slide_width_inches": 13.333,
  "slide_height_inches": 7.5,
  "slides": [
    {
      "layout": "title",
      "title": "Main Title",
      "subtitle": "Subtitle or tagline",
      "notes": "Speaker notes for this slide"
    },
    {
      "layout": "title_content",
      "title": "Slide Title",
      "content": [
        {
          "type": "text",
          "text": "Regular paragraph text",
          "bold": false,
          "font_size": 18,
          "color": "#333333"
        },
        {
          "type": "bullet_list",
          "items": [
            "First bullet point",
            "Second bullet point",
            "Third bullet point"
          ],
          "level": 0,
          "font_size": 16
        },
        {
          "type": "numbered_list",
          "items": ["Step one", "Step two", "Step three"]
        }
      ],
      "notes": "Speaker notes here"
    },
    {
      "layout": "two_column",
      "title": "Comparison Slide",
      "left_content": [
        {"type": "text", "text": "Left column heading", "bold": true},
        {"type": "bullet_list", "items": ["Point A", "Point B"]}
      ],
      "right_content": [
        {"type": "text", "text": "Right column heading", "bold": true},
        {"type": "bullet_list", "items": ["Point C", "Point D"]}
      ]
    },
    {
      "layout": "blank",
      "shapes": [
        {
          "type": "textbox",
          "text": "Custom positioned text",
          "left_inches": 1.0,
          "top_inches": 1.0,
          "width_inches": 5.0,
          "height_inches": 1.5,
          "font_size": 24,
          "bold": true,
          "color": "#2E74B5",
          "alignment": "center"
        },
        {
          "type": "image",
          "path": "/tmp/chart.png",
          "left_inches": 1.0,
          "top_inches": 3.0,
          "width_inches": 8.0
        },
        {
          "type": "rectangle",
          "left_inches": 0.5,
          "top_inches": 0.5,
          "width_inches": 12.0,
          "height_inches": 6.5,
          "fill_color": "#F2F2F2",
          "border_color": "#2E74B5",
          "border_width": 2
        },
        {
          "type": "line",
          "start_x": 1.0,
          "start_y": 4.0,
          "end_x": 12.0,
          "end_y": 4.0,
          "color": "#CCCCCC",
          "width": 1.5
        }
      ]
    },
    {
      "layout": "title_content",
      "title": "Data Table",
      "content": [
        {
          "type": "table",
          "headers": ["Metric", "Q1", "Q2", "Q3", "Q4"],
          "rows": [
            ["Revenue", "$10M", "$12M", "$15M", "$18M"],
            ["Growth", "5%", "8%", "12%", "15%"]
          ],
          "header_bg_color": "#2E74B5",
          "header_font_color": "#FFFFFF",
          "font_size": 12,
          "left_inches": 1.0,
          "top_inches": 2.0,
          "width_inches": 11.0,
          "height_inches": 3.0
        }
      ]
    },
    {
      "layout": "section_header",
      "title": "Section Break Title",
      "subtitle": "Optional section description"
    },
    {
      "layout": "title_only",
      "title": "Title Only Slide",
      "shapes": [
        {
          "type": "image",
          "path": "/tmp/diagram.png",
          "left_inches": 1.5,
          "top_inches": 2.0,
          "width_inches": 10.0
        }
      ]
    }
  ]
}
```

**Available layouts:**

| Layout | Description | Placeholders |
|--------|-------------|-------------|
| `title` | Title slide | title, subtitle |
| `title_content` | Title + body area | title, content |
| `section_header` | Section divider | title, subtitle |
| `two_column` | Two-column layout | title, left_content, right_content |
| `title_only` | Title + blank area | title, shapes |
| `blank` | Fully blank | shapes |
| `comparison` | Side-by-side comparison | title, left_title, left_content, right_title, right_content |
| `content_caption` | Content with caption | title, content, caption |

**Guidelines for creating presentations:**
- Use professional defaults (Calibri, dark text on light backgrounds) unless specified otherwise
- Limit text per slide — prefer bullet points over paragraphs
- 6-8 words per bullet, 6-8 bullets max per slide
- Use a consistent color scheme throughout
- Include speaker notes with additional context and talking points
- Always start with a title slide and end with a closing/Q&A slide
- Always save output to `/tmp/` directory
- After creating, provide the file path and offer to share via `file-sharing`

### 3. Reading Presentations

Use `scripts/read_pptx.py` to extract content from existing .pptx files.

**Extraction modes:**

| Mode | Description | Use Case |
|------|-------------|----------|
| `text` | Plain text from all slides | Quick content review |
| `structured` | JSON with slides, shapes, formatting | Detailed analysis |
| `notes` | Speaker notes only | Preparing to present |
| `outline` | Titles and bullet points | Content overview |
| `images` | Extract embedded images | Image retrieval |
| `tables` | Extract table data | Data extraction |

**Usage:**
```bash
python scripts/read_pptx.py /tmp/presentation.pptx --mode structured
```

**Guidelines for reading:**
- Default to `outline` mode for summary requests
- Use `structured` mode when the user needs formatting details or layout info
- Use `notes` mode for speaker notes extraction
- Use `tables` mode for extracting tabular data
- Extract images to `/tmp/pptx_images/` when requested
- Report slide count and provide a brief outline before dumping full content

### 4. Editing Presentations

Use `scripts/edit_pptx.py` to modify existing .pptx files.

**Supported edit operations:**

```json
{
  "input_path": "/tmp/original.pptx",
  "output_path": "/tmp/edited.pptx",
  "operations": [
    {
      "action": "find_replace",
      "find": "old text",
      "replace": "new text"
    },
    {
      "action": "add_slide",
      "position": 3,
      "layout": "title_content",
      "title": "New Slide Title",
      "content": [
        {"type": "bullet_list", "items": ["Point 1", "Point 2"]}
      ]
    },
    {
      "action": "delete_slide",
      "slide_index": 5
    },
    {
      "action": "reorder_slide",
      "from_index": 2,
      "to_index": 5
    },
    {
      "action": "duplicate_slide",
      "slide_index": 1
    },
    {
      "action": "update_slide_title",
      "slide_index": 0,
      "title": "Updated Title"
    },
    {
      "action": "update_notes",
      "slide_index": 2,
      "notes": "Updated speaker notes for this slide"
    },
    {
      "action": "add_image",
      "slide_index": 1,
      "image_path": "/tmp/photo.png",
      "left_inches": 2.0,
      "top_inches": 2.5,
      "width_inches": 6.0
    },
    {
      "action": "add_textbox",
      "slide_index": 1,
      "text": "Annotation text",
      "left_inches": 8.0,
      "top_inches": 5.0,
      "width_inches": 4.0,
      "height_inches": 1.0,
      "font_size": 14,
      "bold": true
    },
    {
      "action": "add_table",
      "slide_index": 2,
      "headers": ["Name", "Value"],
      "rows": [["A", "1"]],
      "left_inches": 1.0,
      "top_inches": 2.5,
      "width_inches": 10.0,
      "height_inches": 2.0
    },
    {
      "action": "add_shape",
      "slide_index": 3,
      "shape_type": "rectangle",
      "left_inches": 1.0,
      "top_inches": 1.0,
      "width_inches": 4.0,
      "height_inches": 2.0,
      "fill_color": "#2E74B5",
      "text": "Box Label",
      "font_color": "#FFFFFF"
    },
    {
      "action": "set_background",
      "slide_index": 0,
      "color": "#1A1A2E"
    },
    {
      "action": "update_metadata",
      "title": "New Presentation Title",
      "author": "New Author"
    }
  ]
}
```

**Guidelines for editing:**
- Always save to a **new file** by default to preserve the original
- Show the user what changes will be made before applying
- Slide indices are 0-based
- For find/replace, report how many occurrences were found
- Preserve all existing formatting that isn't being explicitly changed

### 5. Merging Presentations

Use `scripts/merge_pptx.py` to combine multiple .pptx files into one.

```bash
python scripts/merge_pptx.py --files /tmp/deck1.pptx /tmp/deck2.pptx /tmp/deck3.pptx --output /tmp/merged.pptx
```

**Options:**
- `--files`: Space-separated list of input .pptx files
- `--output`: Output file path
- `--section_breaks`: Insert a section-header slide between each source deck (default: false)

**Guidelines:**
- Warn the user if presentations have different slide dimensions
- Each source deck's slides are appended in order
- Slide masters/layouts from the first deck are used as the base

### 6. Converting Presentations

Use `scripts/convert_pptx.py` for format conversions.

**Supported conversions:**

| From | To | Method |
|------|----|--------|
| .pptx | .pdf | via LibreOffice CLI |
| .pptx | images (PNG) | slide-by-slide rendering |
| .pptx | .txt | text extraction |
| .pptx | .md | outline extraction |
| .pptx | .html | structured HTML export |

```bash
python scripts/convert_pptx.py /tmp/input.pptx --to pdf --output /tmp/output.pdf
python scripts/convert_pptx.py /tmp/input.pptx --to images --output /tmp/slides/
```

**Guidelines:**
- For PDF conversion, use LibreOffice (`libreoffice --headless --convert-to pdf`) when available
- For image export, output one PNG per slide named `slide_001.png`, `slide_002.png`, etc.
- Warn about formatting loss in lossy conversions (e.g., animations won't appear in PDF)

### 7. Template Filling

Use `scripts/template_fill.py` to fill placeholder values in a template .pptx.

**Placeholders** use double-curly-brace syntax: `{{placeholder_name}}`

```bash
python scripts/template_fill.py /tmp/template.pptx --values '{"company": "Acme Corp", "date": "2025-06-01", "presenter": "Jane Smith"}' --output /tmp/filled.pptx
```

**Guidelines:**
- Scan the template first with `--scan` to identify all placeholders
- Report any placeholders that don't have values provided
- Preserve all slide formatting, layouts, and masters
- Handle placeholders in titles, body text, tables, and notes

### 8. Inspecting Presentations

Use `scripts/inspect_pptx.py` to get structural information about a presentation.

```bash
python scripts/inspect_pptx.py /tmp/presentation.pptx
```

**Returns:**
- Presentation metadata (title, author, dates)
- Slide dimensions
- Slide count
- Per-slide summary: layout name, title, shape count, has notes, has table, has image
- Slide master and layout inventory
- Total image count, table count
- Word count, character count
- File size

## Constraints

- All file operations are limited to the `/tmp` directory
- Maximum supported file size: 100 MB
- Images inserted must be PNG, JPEG, GIF, or SVG format
- Animations and transitions cannot be created programmatically — they are preserved when editing existing files
- Embedded video/audio cannot be inserted — only referenced via file path
- SmartArt and charts cannot be created from scratch but are preserved in existing files
- Slide masters can be read but not created from scratch (use an existing template instead)
- Only .pptx format is supported — not .ppt (legacy), .ppsx, or .potx
- Font rendering in exports depends on fonts available in the runtime

## Error Handling

- If a .pptx file is corrupted or unreadable, report the error and suggest re-upload
- If a required library is missing, install it via `pip install python-pptx`
- If LibreOffice is not available for PDF/image conversion, report the limitation
- If a slide index is out of range, report the valid range
- If an image file is not found, report and skip (don't crash)
- If the presentation uses features not supported by python-pptx, preserve them untouched

## Examples

**User**: "Create a 10-slide pitch deck for our product launch"

Steps:
1. Build a JSON spec with: title slide, problem statement, solution, market opportunity, product demo (images), business model, traction, team, financials, closing/CTA
2. Include appropriate speaker notes for each slide
3. Run `scripts/create_pptx.py` with the spec
4. Return file path and offer download via `file-sharing`

**User**: "Extract the speaker notes from this presentation"

Steps:
1. Run `scripts/read_pptx.py /tmp/uploaded.pptx --mode notes`
2. Display notes per slide in chat

**User**: "Replace the company name throughout this deck"

Steps:
1. Run `scripts/edit_pptx.py` with a `find_replace` operation
2. Report how many replacements were made across how many slides
3. Return the edited file path

**User**: "Combine these three decks into one presentation"

Steps:
1. Run `scripts/merge_pptx.py` with the three file paths
2. Return the merged file path

**User**: "Convert this presentation to PDF"

Steps:
1. Run `scripts/convert_pptx.py /tmp/deck.pptx --to pdf`
2. Return the PDF file path

**User**: "Add a new slide after slide 3 with a comparison table"

Steps:
1. Run `scripts/edit_pptx.py` with an `add_slide` operation at position 3
2. Include the table content
3. Return the edited file path

## Chaining

This skill works best when combined with:
- `code_interpreter` — generate charts/visualizations to embed in slides
- `data-analysis` — analyze data and produce charts or summary tables for slides
- `docx-editor` — convert presentation content to a Word document or vice versa
- `document-summary` — summarize a presentation before sharing
- `rag-search` — pull knowledge base content to include in slides
- `file-sharing` — deliver generated .pptx files to the user for download
- `email-draft` — create a deck and then draft an email with it attached
- `web-search` — research topics and include findings in slides
