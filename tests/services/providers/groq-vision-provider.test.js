import assert from "node:assert/strict";
import test from "node:test";

import { GroqVisionProvider } from "../../../app/services/providers/groq-vision-provider.js";

test("Groq vision provider implements analyzeImage contract", async () => {
  let capturedRequest;

  const fakeFetch = async (url, options) => {
    capturedRequest = {
      url,
      options
    };

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                subject: "patient monitor",
                category: "medical_equipment",
                attributes: [
                  "bedside",
                  "vital signs",
                  "display"
                ],
                caption:
                  "A patient monitor displaying vital signs.",
                confidence: 0.92
              })
            }
          }
        ]
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  };

  const provider = new GroqVisionProvider({
    apiKey: "test-key",
    model: "qwen/qwen3.6-27b",
    fetchImpl: fakeFetch
  });

  const result = await provider.analyzeImage(
    Buffer.from("fake-image")
  );

  assert.deepEqual(result, {
    subject: "patient monitor",
    category: "medical_equipment",
    attributes: [
      "bedside",
      "vital signs",
      "display"
    ],
    caption:
      "A patient monitor displaying vital signs.",
    confidence: 0.92
  });

  assert.equal(
    capturedRequest.url,
    "https://api.groq.com/openai/v1/chat/completions"
  );

  assert.equal(
    capturedRequest.options.headers.Authorization,
    "Bearer test-key"
  );

  const body = JSON.parse(capturedRequest.options.body);

  assert.equal(
    body.model,
    "qwen/qwen3.6-27b"
  );

  assert.equal(
    body.response_format.type,
    "json_object"
  );

  assert.equal(
    body.messages[0].content[1].type,
    "image_url"
  );

  assert.equal(
    body.messages[0].content[1].image_url.url,
    `data:image/jpeg;base64,${Buffer.from("fake-image").toString("base64")}`
  );
});

test("Groq vision provider rejects API errors", async () => {
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

  const provider = new GroqVisionProvider({
    apiKey: "bad-key",
    fetchImpl: fakeFetch
  });

  await assert.rejects(
    () => provider.analyzeImage(Buffer.from("fake-image")),
    /Groq API error: Invalid API key/
  );
});

test("Groq vision provider rejects invalid JSON responses", async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: "not valid json"
            }
          }
        ]
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  const provider = new GroqVisionProvider({
    apiKey: "test-key",
    fetchImpl: fakeFetch
  });

  await assert.rejects(
    () => provider.analyzeImage(Buffer.from("fake-image")),
    /Groq API returned invalid JSON metadata/
  );
});

test("Groq vision provider rejects non-buffer input", async () => {
  const provider = new GroqVisionProvider({
    apiKey: "test-key",
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    }
  });

  await assert.rejects(
    () => provider.analyzeImage("fake-image"),
    /GroqVisionProvider requires a Buffer/
  );
});

test("Groq vision provider rejects empty image buffers", async () => {
  const provider = new GroqVisionProvider({
    apiKey: "test-key",
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    }
  });

  await assert.rejects(
    () => provider.analyzeImage(Buffer.alloc(0)),
    /Cannot analyze an empty image buffer/
  );
});
