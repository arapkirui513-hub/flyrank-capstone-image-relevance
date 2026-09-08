import { EmbeddingProvider } from "./embedding-provider.js";

export class GeminiEmbeddingProvider extends EmbeddingProvider {
  constructor(
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.EMBEDDING_MODEL || "gemini-embedding-2",
    fetchImpl = fetch
  ) {
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
      throw new TypeError(
        "GeminiEmbeddingProvider requires a string."
      );
    }

    if (text.trim().length === 0) {
      throw new Error(
        "GeminiEmbeddingProvider requires non-empty text."
      );
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${this.model}:embedContent`;

    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey
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
    });

    const responseBody = await response.json();

    if (!response.ok) {
      const message =
        responseBody?.error?.message ||
        `Gemini API request failed with HTTP ${response.status}.`;

      throw new Error(`Gemini API error: ${message}`);
    }

    const values = responseBody?.embedding?.values;

    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      !values.every((value) => Number.isFinite(value))
    ) {
      throw new Error(
        "Gemini API returned an invalid embedding."
      );
    }

    return values;
  }
}

export default GeminiEmbeddingProvider;
