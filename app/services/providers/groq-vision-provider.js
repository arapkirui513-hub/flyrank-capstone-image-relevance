import { VisionProvider } from "./vision-provider.js";

const DEFAULT_PROMPT = `
Analyze this medical equipment image.

Return a JSON object containing exactly these fields:
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

export class GroqVisionProvider extends VisionProvider {
  constructor({
    apiKey = process.env.GROQ_API_KEY,
    model = process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b",
    fetchImpl = fetch
  } = {}) {
    super();

    if (!apiKey) {
      throw new Error("GROQ_API_KEY is required.");
    }

    this.apiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl;
  }

  async analyzeImage(imageBuffer, mimeType = "image/jpeg") {
    if (!Buffer.isBuffer(imageBuffer)) {
      throw new TypeError("GroqVisionProvider requires a Buffer.");
    }

    if (imageBuffer.length === 0) {
      throw new Error("Cannot analyze an empty image buffer.");
    }

    const url = "https://api.groq.com/openai/v1/chat/completions";

    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: DEFAULT_PROMPT
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBuffer.toString("base64")}`
                }
              }
            ]
          }
        ],
        response_format: {
          type: "json_object"
      },
        max_completion_tokens: 512,
        reasoning_effort: "none"
      })
    });

    const responseBody = await response.json();

    if (!response.ok) {
  const message =
    responseBody?.error?.message ||
    `Groq API request failed with HTTP ${response.status}.`;

  const failedGeneration =
    responseBody?.error?.failed_generation;

  const details = failedGeneration
    ? `${message} Failed generation: ${failedGeneration}`
    : message;

  throw new Error(`Groq API error: ${details}`);
}
    const text =
      responseBody?.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error("Groq API returned no text content.");
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Groq API returned invalid JSON metadata.");
    }
  }
}

export default GroqVisionProvider;
