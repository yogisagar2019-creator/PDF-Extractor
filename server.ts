import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // JSON payload limit for high-res page crops or base64 image data
  app.use(express.json({ limit: '35mb' }));

  // API endpoint for optional Cloud OCR / AI extraction (with explicit user consent)
  app.post('/api/gemini/extract-question', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY is not configured on the server. Please use local offline processing or configure the API key in environment.',
        });
      }

      const { imageBase64, mimeType = 'image/png', questionNumber } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'Missing imageBase64 in request body' });
      }

      // Initialize Gemini client
      const ai = new GoogleGenAI({ apiKey });

      // Clean base64 data if it contains data URI prefix
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

      const prompt = `You are an expert Devanagari OCR, Hindi reasoning exam question transcription, and vector diagram reconstruction specialist.
Analyze this scanned image of a printed Hindi reasoning question page from a practice set.

CRITICAL OCR & TRANSCRIPTION RULES:
1. PURE PRINTED TYPOGRAPHY: Ignore and suppress all student pen marks (red pen, blue pen, black ink ticks, circles, checkmarks, underlines, annotations). Extract ONLY the original printed material.
2. CLEAN HEADERS & METADATA: Ignore page headers, page footers, practice set titles, logos, coaching stamps, or page numbers (like "Page 1 of 10").
3. NEVER CROP AND PASTE TEXT: Transcribe all text into pristine, high-fidelity typed Hindi Devanagari and English. Preserve exact mathematical symbols, numbers, and punctuation.
4. DIAGRAM REDRAWING REQUIREMENT (NO DIRECT CROP):
   - "hasDiagram": Set to true ONLY if there is an isolated visual geometric diagram, Venn diagram circles, dice faces, matrix table grid, or triangle/square counting drawing that cannot be expressed as regular text. Set to false for text-only questions, number series, syllogisms, or verbal reasoning!
   - "diagramType": 'venn' | 'dice' | 'triangle_count' | 'matrix_grid' | 'direction_compass' | 'clock' | 'custom_svg' | null
   - "diagramDescription": Short description of the visual diagram.
   - "diagramBox": If hasDiagram is true, provide normalized bounding box { "x": number (0-1), "y": number (0-1), "width": number (0-1), "height": number (0-1) } containing strictly the graphical figure. If no diagram, null.
   - "diagramSvg": IF hasDiagram IS TRUE, DO NOT JUST CROP! Provide a complete, standalone, pristine SVG vector redraw string (<svg viewBox="0 0 500 240" xmlns="http://www.w3.org/2000/svg">...</svg>) that completely reconstructs and redraws the diagram from scratch!
     * Pure clean white background: <rect width="100%" height="100%" fill="#ffffff" rx="8"/>
     * High-contrast dark stroke lines: stroke="#0f172a" stroke-width="2.5" or 3
     * Crisp typography: font-family="sans-serif" font-weight="bold" fill="#0f172a"
     * Recreate all shapes cleanly: Venn circles with clean region labels/numbers; 3D isometric dice cubes with numbers or dots; triangle counting geometry lines; or matrix grid with numbers and red '?'.
     * ABSOLUTELY ZERO student ink, pen marks, or scan blur. Pure digital vector.

5. EXTRACT THESE FIELDS:
   - "questionText": The printed question statement in Hindi (e.g. "दी गई शृंखला में प्रश्नचिह्न (?) के स्थान पर कौन-सी संख्या आएगी?", or statements like "कथन :\n1. सभी गाड़ियाँ बस हैं।\n2. कुछ बस कार हैं।\nनिष्कर्ष :\nI. कुछ कार गाड़ियाँ हैं।\nII. कोई कार गाड़ी नहीं है।").
     IMPORTANT: Strip any leading question number prefix like "प्रश्न 1.", "प्र. 1.", "Q1.", "1.", "1 )" from questionText.
   - "seriesText": (optional string) If the question contains an equation, analogy, or sequence (e.g. "14, 28, 20, 40, 32, 64, ?" or "12 : 144 :: 15 : ?" or "40 ÷ 8 + 4 × 5 − 2 = ?"), provide it cleanly here.
   - "options": An array of EXACTLY 4 options (A, B, C, D).
     Each option MUST be: { "label": "A" | "B" | "C" | "D", "text": "...", "isCorrect": boolean }
     IMPORTANT: "text" must contain ONLY the option text, WITHOUT repeating the option label (e.g. if print says "(A) 56", return label: "A", text: "56", NOT text: "(A) 56").
     If an option has a checkmark or tick or is indicated as correct, set isCorrect: true.
   - "category": Reasoning category in Hindi/English (e.g. "संख्या शृंखला (Number Series)", "सादृश्यता परीक्षण (Analogy)", "वेन आरेख (Venn Diagram)", "कथन एवं निष्कर्ष (Syllogism)", "पासा एवं घन (Dice & Cube)", "लुप्त पद (Missing Number)").
   - "confidenceScore": Estimated confidence between 0.85 and 1.0.

Respond strictly with valid JSON:
{
  "questionText": "...",
  "seriesText": "...",
  "options": [
    {"label": "A", "text": "...", "isCorrect": false},
    {"label": "B", "text": "...", "isCorrect": false},
    {"label": "C", "text": "...", "isCorrect": false},
    {"label": "D", "text": "...", "isCorrect": false}
  ],
  "hasDiagram": false,
  "diagramType": null,
  "diagramDescription": "",
  "diagramSvg": null,
  "diagramBox": null,
  "category": "...",
  "confidenceScore": 0.98
}`;

      // Multi-model fallback list in order of preference
      const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
      let lastError: any = null;
      let text = '';

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: cleanBase64,
                    },
                  },
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          });
          text = response.text || '';
          if (text) {
            break;
          }
        } catch (err: any) {
          console.warn(`Model ${modelName} extraction note:`, err?.message || err);
          lastError = err;
        }
      }

      if (!text) {
        throw lastError || new Error('No response received from AI models');
      }

      // Parse JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(500).json({ error: 'Failed to parse JSON from AI model response', raw: text });
      }

      const parsedData = JSON.parse(jsonMatch[0]);
      return res.json({ success: true, data: parsedData });
    } catch (err: any) {
      console.error('Error in /api/gemini/extract-question:', err);
      return res.status(500).json({ error: err.message || 'Internal server error during OCR' });
    }
  });

  // Dedicated Diagram Redraw API: Re-generates pristine vector SVG from scanned image or description
  app.post('/api/gemini/redraw-diagram', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server' });
      }

      const { imageBase64, mimeType = 'image/png', questionText = '', diagramType = '', description = '' } = req.body;
      const ai = new GoogleGenAI({ apiKey });

      const redrawPrompt = `You are a specialist scientific illustrator and competitive exam reasoning diagram redraw engine.
TASK: Redraw this reasoning exam diagram as a pristine, professional vector SVG.
DO NOT crop or paste scanned bitmap images!
DO NOT copy student pen marks, handwriting, ink scribbles, or paper background!

DIAGRAM SPECIFICATIONS:
- Question context: "${questionText}"
- Diagram category: "${diagramType}"
- Details: "${description}"

SVG REQUIREMENTS:
1. Standard dimensions: viewBox="0 0 500 250" xmlns="http://www.w3.org/2000/svg"
2. Background: <rect width="100%" height="100%" fill="#ffffff" rx="10"/>
3. Strokes: High-contrast stroke="#0f172a" stroke-width="2.5" (or 3 for outer borders)
4. Labels & Text: font-family="sans-serif", font-weight="bold", fill="#0f172a"
5. Geometry accuracy:
   - For Venn Diagrams: perfectly proportioned overlapping circles/shapes with crisp region labels and numbers.
   - For Dice / Cubes: 3D isometric cubes with clean numbers (or pips) on top, left, right faces and captions (चित्र I, चित्र II).
   - For Matrix / Number Grids: balanced grid cells with centered numbers, and red bold '?' for the missing number cell.
   - For Counting Triangles / Squares: precise vertices, medians, and horizontal lines.
   - For Direction & Distance: clear compass arrows (N, S, E, W) and step paths with distance tags.
6. Respond with ONLY the raw SVG code starting with <svg and ending with </svg>. Do not wrap in markdown or backticks if possible, or wrap in \`\`\`xml.`;

      const parts: any[] = [];
      if (imageBase64) {
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType,
            data: cleanBase64,
          },
        });
      }
      parts.push({ text: redrawPrompt });

      const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
      let svgOutput = '';
      let lastErr: any = null;

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts }],
          });
          const text = response.text || '';
          const match = text.match(/<svg[\s\S]*?<\/svg>/i);
          if (match) {
            svgOutput = match[0];
            break;
          }
        } catch (err: any) {
          console.warn(`Model ${modelName} redraw error:`, err?.message || err);
          lastErr = err;
        }
      }

      if (!svgOutput) {
        throw lastErr || new Error('Failed to generate SVG redraw');
      }

      return res.json({ success: true, diagramSvg: svgOutput });
    } catch (err: any) {
      console.error('Error in /api/gemini/redraw-diagram:', err);
      return res.status(500).json({ error: err.message || 'Diagram redraw failed' });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // Setup Vite dev server or static files
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
