import { EmbeddingProvider } from "./embedding-provider.js";

export class GeminiEmbeddingProvider extends EmbeddingProvider {
  constructor({
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.EMBEDDING_MODEL || "gemini-embedding-001",
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

  async embedText(text) {
    if (typeof text !== "string") {
      throw new TypeError("text must be a string.");
    }

    if (!text.trim()) {
      throw new Error("text must not be empty.");
    }

    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: {
            parts: [
              {
                text
              }
            ]
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

    const values = responseBody?.embedding?.values;

    if (!Array.isArray(values) || values.length === 0) {
      throw new Error("Gemini API returned an invalid embedding.");
    }

    return {
      data: values,
      usage: {
        inputTokens:
          responseBody?.usageMetadata?.promptTokenCount ?? null,
        outputTokens: null
      }
    };
  }
}

export default GeminiEmbeddingProvider;
