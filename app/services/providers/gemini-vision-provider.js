import { VisionProvider } from "./vision-provider.js";

const DEFAULT_PROMPT = `
Analyze this image and return JSON with exactly these fields:
- subject: the primary object or equipment shown
- category: the broad category
- attributes: an array of useful visual attributes
- caption: a concise description of the image
- confidence: a number from 0 to 1 representing confidence in the identification

Do not include markdown fences or additional commentary.
`;

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

  async analyzeImage(imageBuffer, mimeType = "image/jpeg") {
    if (!Buffer.isBuffer(imageBuffer)) {
      throw new TypeError("imageBuffer must be a Buffer.");
    }

    if (imageBuffer.length === 0) {
      throw new Error("imageBuffer must not be empty.");
    }

    const base64Image = imageBuffer.toString("base64");

    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: DEFAULT_PROMPT
                },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Image
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      }
    );

    const responseBody = await response.json();

    if (!response.ok) {
      const details =
        responseBody?.error?.message ||
        responseBody?.error ||
        `HTTP ${response.status}`;

      throw new Error(`Gemini API error: ${details}`);
    }

    const text = responseBody?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Gemini API returned no response content.");
    }

    try {
      return {
        data: JSON.parse(text),
        usage: {
          inputTokens:
            responseBody?.usageMetadata?.promptTokenCount ?? null,
          outputTokens:
            responseBody?.usageMetadata?.candidatesTokenCount ?? null
        }
      };
    } catch {
      throw new Error("Gemini API returned invalid JSON metadata.");
    }
  }
}

export default GeminiVisionProvider;
