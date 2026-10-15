# Reasoning PDF Studio Auto
**Production-Quality Hindi Reasoning Practice PDF Reconstruction & 16:9 Presentation Studio**

---

## 1. Overview & Architecture

**Reasoning PDF Studio Auto** transforms scanned Hindi reasoning practice test papers into professional, 16:9 landscape presentation PDF slides (1152 × 648 pt).

Designed specifically for Hindi competitive exams (SSC CGL, Railway NTPC, Banking, State Police, PSC), the application systematically extracts printed Devanagari text, numerical/alphabetical series, 4 options (A, B, C, D), and reasoning diagrams while removing handwritten red/blue pen ticks, circles, student notes, coaching institute headers, and watermarks.

### Architectural Pipeline

```
  [ Scanned Source PDF ] (1 Question / Page)
            │
            ▼
┌─────────────────────────┐
│ Stage A: Render & High  │  • 2.0× Super-Sampled Rendering (DPI 144) via PDF.js
│ DPI Inspection          │  • Devanagari Matra & Diacritic legibility preservation
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Stage B & C: Multi-Pass │  • Color Ratio & HSV Space Red/Blue Pen Mark Detector
│ Preprocessing & Pen     │  • Morphological Dilation & Background Inpainting
│ Suppression             │  • Contrast Normalization & Selective Bilateral Denoising
│                         │  • Overlapping Handwriting Flagging & Manual Mask Brush
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Stage D: Segmentation & │  • Connected-Component Diagram & Matrix Isolation
│ Devanagari OCR          │  • Multi-Pass Tesseract.js (hin + eng) & Local Pattern Matcher
│                         │  • Optional Cloud AI Vision (Gemini 3.8 Flash) via Proxy
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Verification & 16:9     │  • Dual-Pane Verification (Clean Scan vs 16:9 Slide)
│ PDF Generation          │  • Reset Numbering to Q1, Q2, Q3...
│                         │  • jsPDF 1152 × 648 pt Output with Noto Sans Devanagari
└─────────────────────────┘
```

---

## 2. Key Features

- **Strict Page Handling**: Default setting skips Source Page 1 (cover page). For an 11-page scanned PDF with page 1 skipped, exactly 10 output slides are generated.
- **Pristine Question Numbering**: Question labels are strictly reset to **Q1, Q2, Q3...** without copying old page numbers or previous labels.
- **Handwriting & Pen Suppression**: Erases student red ink marks, blue ballpoint underlines, and stray annotations using adaptive color filters and background inpainting.
- **Diagram & Matrix Preservation**: Auto-detects and isolates Venn diagrams, dice projections, and numeric matrices. Includes an interactive rectangle crop & clean tool.
- **Option Partitioning**: Detects 4 options `(A)`, `(B)`, `(C)`, `(D)` or `(1)`, `(2)`, `(3)`, `(4)` without merging into the question prompt.
- **16:9 Landscape PDF Export (1152 × 648 pt)**: Outputs presentation-ready slides in multiple themes (*EdTech Studio*, *Exam Minimal*, *Dark Board*, *Academic Red*).
- **Dual-Pane Verification Studio**: Compare Original Scan, Cleaned Scan, Pen Mask, and Binarized view side-by-side with the editable question cards and live slide preview.
- **Bilingual Interface**: Full support for both Hindi (हिंदी) and English.
- **Audit & Debug Export**: Download structured data in **JSON** or clean **TXT** format.

---

## 3. Local Run Instructions for Windows

### Prerequisites
- Node.js 18.x, 20.x, or 22.x installed on Windows
- npm 9.x or higher

### Step-by-Step Windows Setup

1. **Clone or Download Repository**
   ```cmd
   git clone <repository_url>
   cd reasoning-pdf-studio-auto
   ```

2. **Install Dependencies**
   ```cmd
   npm install
   ```

3. **Configure Environment Variables (Optional for Cloud AI)**
   Copy `.env.example` to `.env`:
   ```cmd
   copy .env.example .env
   ```
   Add your Google Gemini API key if you wish to enable the optional Cloud AI Vision extractor:
   ```env
   GEMINI_API_KEY="your_api_key_here"
   ```
   *(Note: Local CV and Tesseract OCR work 100% offline without any API key).*

4. **Launch Local Development Server**
   ```cmd
   npm run dev
   ```
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

5. **Production Build**
   ```cmd
   npm run build
   npm run start
   ```

---

## 4. OCR Model Requirements & Offline Operations

- **Offline Local CV Pattern Engine**: Bundled directly with the application; requires zero downloads or internet access.
- **Tesseract.js Engine**: Uses the `hin` (Devanagari/Hindi) and `eng` (English) trained data models. Models are cached in IndexedDB upon first download.
- **Google Fonts (Devanagari)**: `Noto Sans Devanagari` and `Inter` are loaded for crisp glyphs, conjuncts (हलंत, संयुक्त वर्ण), and matras.

---

## 5. Repeatable Test Procedure

### Test 1: Section 12 Master Acceptance Test
1. Launch the application.
2. In the top navigation bar, click **"Sec. 12 Test"**.
3. Verify that:
   - Exactly one question is loaded with label **Q1**.
   - Question text: `"दी गई श्रृंखला में लुप्त संख्या ज्ञात कीजिए ?"`
   - Series preserved: `"2, 5, 9, ? 20, 27"`
   - 4 Options separated: `(A) 14`, `(B) 16`, `(C) 18`, `(D) 24`.
   - Red circle around `?` and red tick on Option (A) are suppressed in the cleaned scan.
   - Click **"Export 16:9 PDF"** and verify that 1 landscape slide of 1152 × 648 pt is generated.

### Test 2: 11-Page Hindi Scanned Practice Set Test
1. Click **"11-Page Hindi Demo"** in the top bar or upload screen.
2. Observe the progress bar:
   - Source page 1 (cover with exam instructions) is skipped.
   - Pages 2 through 11 are processed sequentially.
3. Verify bottom thumbnail strip contains exactly **10 questions (Q1 to Q10)**.
4. Verify that:
   - Page 4 (Q3) contains a cropped Venn diagram.
   - Page 9 (Q8) contains a cropped dice figure.
   - Page 10 (Q9) contains a cropped missing number matrix.
5. Click **"Export 16:9 PDF"**. Pre-export validation will verify page counts and generate the presentation PDF.

### Test 3: Automated Unit Test Suite
1. Click **"Unit Tests"** in the top header.
2. The modal runs the automated suite covering:
   - Strict Page Count Rule (`N - 1` for `skipPage1=true`)
   - Sequential Numbering Reset (purging old "प्रश्न 28." tags)
   - 4-Option Grouping & Isolation
   - 16:9 Aspect Ratio Geometry (`1152 pt × 648 pt`)
   - Section 12 Master Acceptance Criteria

---

## 6. Troubleshooting

- **PDF does not render**: Ensure the uploaded file is not password-protected or corrupted. Try converting to a standard PDF 1.4+ format.
- **Devanagari text appears with boxes or misplaced matras**: Ensure your browser supports Web Fonts and allows Google Fonts CDN (`fonts.googleapis.com`).
- **Heavy red pen marks bleed into text**: Click the **"Brush Tool"** on the left pane to open the manual mask correction canvas. Use the paper-white eraser to paint over stubborn pen artifacts.
