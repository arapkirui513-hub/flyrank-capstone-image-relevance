import { VisionProvider } from "./vision-provider.js";

const DEFAULT_PROMPT = `
Analyze this medical equipment image.

Return ONLY valid JSON with exactly these fields:
{
  "subject": "string",
  "category": "string",
  "attributes": ["string"],
  "caption": "string",
  "confidence": 0.0
}

Rules:
- subject: identify the specific medical equipment shown.
- category: identify the broad category, such as "medical_equipment".
- attributes: list observable physical or functional characteristics.
- caption: write a concise description of the image.
- confidence: number from 0 to 1 representing confidence in the identification.
- Do not include markdown.
- Do not include explanations outside the JSON object.
`.trim();

export class GeminiVisionProvider extends VisionProvider {
  constructor({
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.VISION_MODEL || "gemini-3.6-flash",
    fetchImpl = fetch
  } = {}) {
    super();

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required.");
    }

    this.apiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl;
  }

  async analyzeImage(imageBuffer) {
    if (!Buffer.isBuffer(imageBuffer)) {
      throw new TypeError("GeminiVisionProvider requires a Buffer.");
    }

    if (imageBuffer.length === 0) {
      throw new Error("Cannot analyze an empty image buffer.");
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${this.model}:generateContent`;

    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: DEFAULT_PROMPT
              },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: imageBuffer.toString("base64")
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const responseBody = await response.json();

    if (!response.ok) {
      const message =
        responseBody?.error?.message ||
        `Gemini API request failed with HTTP ${response.status}.`;

      throw new Error(`Gemini API error: ${message}`);
    }

    const text =
      responseBody?.candidates?.[0]?.content?.parts?.find(
        (part) => typeof part.text === "string"
      )?.text;

    if (!text) {
      throw new Error("Gemini API returned no text content.");
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Gemini API returned invalid JSON metadata.");
    }
  }
}
