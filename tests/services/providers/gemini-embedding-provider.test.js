import assert from "node:assert/strict";
import test from "node:test";

import GeminiEmbeddingProvider from "../../../app/services/providers/gemini-embedding-provider.js";

test("Gemini embedding provider implements embedText contract", async () => {
  const fakeFetch = async (_url, options) => {
    const body = JSON.parse(options.body);

    assert.equal(
      body.content.parts[0].text,
      "A patient monitor displaying vital signs."
    );

    return new Response(
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
  };

  const provider = new GeminiEmbeddingProvider(
    "test-key",
    "gemini-embedding-2",
    fakeFetch
  );

  const result = await provider.embedText(
    "A patient monitor displaying vital signs."
  );

  assert.deepEqual(result, [0.1, 0.2, 0.3, 0.4]);
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

  const provider = new GeminiEmbeddingProvider(
    "test-key",
    "gemini-embedding-2",
    fakeFetch
  );

  await assert.rejects(
    () => provider.embedText("test"),
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

  const provider = new GeminiEmbeddingProvider(
    "test-key",
    "gemini-embedding-2",
    fakeFetch
  );

  await assert.rejects(
    () => provider.embedText("test"),
    /invalid embedding/
  );
});

test("Gemini embedding provider rejects empty text", async () => {
  const provider = new GeminiEmbeddingProvider(
    "test-key",
    "gemini-embedding-2",
    async () => {
      throw new Error("fetch should not be called");
    }
  );

  await assert.rejects(
    () => provider.embedText("   "),
    /requires non-empty text/
  );
});
