import { VisionProvider } from "./vision-provider.js";

const DEFAULT_PROMPT = `
Analyze this image and identify the primary object or equipment shown.

Return ONLY one valid JSON object.
Do not return markdown.
Do not return explanations.
Do not return text before or after the JSON object.

The JSON object MUST contain exactly these fields:
{
  "subject": "primary object or equipment",
  "category": "broad category",
  "attributes": ["short visual attribute"],
  "caption": "one concise sentence describing the image",
  "confidence": 0.0
}

Rules:
- subject must be a short noun phrase.
- category must be a broad equipment category.
- attributes must be an array of no more than 5 short strings.
- caption must be one concise sentence.
- confidence must be a number between 0 and 1.
- Do not include any additional fields.
`;

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
      throw new TypeError("imageBuffer must be a Buffer.");
    }

    if (imageBuffer.length === 0) {
      throw new Error("imageBuffer must not be empty.");
    }

    const base64Image = imageBuffer.toString("base64");

    const response = await this.fetchImpl(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          reasoning_effort: "none",
          max_tokens: 256,

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
                    url: `data:${mimeType};base64,${base64Image}`
                  }
                }
              ]
            }
          ]
        })
      }
    );

    const responseBody = await response.json();

    if (!response.ok) {
  const details =
    responseBody?.error?.message ||
    responseBody?.error ||
    `HTTP ${response.status}`;

  const failedGeneration =
    typeof responseBody?.error?.failed_generation === "string"
      ? responseBody.error.failed_generation.slice(0, 1000)
      : null;

  const diagnostic = failedGeneration
    ? ` failed_generation=${failedGeneration}`
    : "";

  throw new Error(`Groq API error: ${details}${diagnostic}`);
}

    const text = responseBody?.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error("Groq API returned no response content.");
    }

    try {
      return {
        data: JSON.parse(text),
        usage: {
          inputTokens: responseBody?.usage?.prompt_tokens ?? null,
          outputTokens: responseBody?.usage?.completion_tokens ?? null
        }
      };
    } catch {
      throw new Error("Groq API returned invalid JSON metadata.");
    }
  }
}

export default GroqVisionProvider;

