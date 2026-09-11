import assert from "node:assert/strict";
import test from "node:test";
import { GeminiEmbeddingProvider } from "../../../app/services/providers/gemini-embedding-provider.js";

test("Gemini embedding provider implements embedText contract", async () => {
  const fakeFetch = async (url, options) => {
    assert.equal(
      url,
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=test-key"
    );

    const body = JSON.parse(options.body);

    assert.deepEqual(body, {
      content: {
        parts: [
          {
            text: "patient monitor maintenance"
          }
        ]
      }
    });

    return new Response(
      JSON.stringify({
        embedding: {
          values: [0.1, 0.2, 0.3, 0.4]
        },
        usageMetadata: {
          promptTokenCount: 12
        }
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  };

  const provider = new GeminiEmbeddingProvider({
    apiKey: "test-key",
    fetchImpl: fakeFetch
  });

  const result = await provider.embedText(
    "patient monitor maintenance"
  );

  assert.deepEqual(result, {
    data: [0.1, 0.2, 0.3, 0.4],
    usage: {
      inputTokens: 12,
      outputTokens: null
    }
  });
});

test("Gemini embedding provider preserves missing usage metadata as null", async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({
        embedding: {
          values: [0.1, 0.2, 0.3, 0.4]
        }
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  const provider = new GeminiEmbeddingProvider({
    apiKey: "test-key",
    fetchImpl: fakeFetch
  });

  const result = await provider.embedText(
    "patient monitor maintenance"
  );

  assert.deepEqual(result.usage, {
    inputTokens: null,
    outputTokens: null
  });
});

test("Gemini embedding provider rejects API errors", async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          message: "Invalid API key"
        }
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  const provider = new GeminiEmbeddingProvider({
    apiKey: "test-key",
    fetchImpl: fakeFetch
  });

  await assert.rejects(
    () => provider.embedText("patient monitor maintenance"),
    /Gemini API error: Invalid API key/
  );
});

test("Gemini embedding provider rejects invalid embeddings", async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({
        embedding: {
          values: []
        }
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  const provider = new GeminiEmbeddingProvider({
    apiKey: "test-key",
    fetchImpl: fakeFetch
  });

  await assert.rejects(
    () => provider.embedText("patient monitor maintenance"),
    /invalid embedding/
  );
});

test("Gemini embedding provider rejects empty text", async () => {
  const provider = new GeminiEmbeddingProvider({
    apiKey: "test-key"
  });

  await assert.rejects(
    () => provider.embedText("   "),
    /text must not be empty/
  );
});

test("GeminiEmbeddingProvider requires an API key", () => {
  assert.throws(
    () =>
      new GeminiEmbeddingProvider({
        apiKey: ""
      }),
    /GEMINI_API_KEY is required/
  );
});

test("GeminiEmbeddingProvider rejects non-string text", async () => {
  const provider = new GeminiEmbeddingProvider({
    apiKey: "test-key"
  });

  await assert.rejects(
    () => provider.embedText(123),
    /text must be a string/
  );
});
