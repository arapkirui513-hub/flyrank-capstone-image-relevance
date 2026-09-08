import assert from "node:assert/strict";
import test from "node:test";

import { GeminiVisionProvider } from "../../../app/services/providers/gemini-vision-provider.js";

test("Gemini vision provider implements analyzeImage contract", async () => {
  let capturedRequest;

  const fakeFetch = async (url, options) => {
    capturedRequest = {
      url,
      options
    };

    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
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
              ]
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

  const provider = new GeminiVisionProvider({
    apiKey: "test-key",
    model: "gemini-3.6-flash",
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
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent"
  );

  assert.equal(
    capturedRequest.options.headers["x-goog-api-key"],
    "test-key"
  );

  const body = JSON.parse(capturedRequest.options.body);

  assert.equal(
    body.generationConfig.responseMimeType,
    "application/json"
  );

  assert.equal(
    body.contents[0].parts[1].inlineData.mimeType,
    "image/jpeg"
  );

  assert.equal(
    body.contents[0].parts[1].inlineData.data,
    Buffer.from("fake-image").toString("base64")
  );
});

test("Gemini vision provider rejects API errors", async () => {
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

  const provider = new GeminiVisionProvider({
    apiKey: "bad-key",
    fetchImpl: fakeFetch
  });

  await assert.rejects(
    () => provider.analyzeImage(Buffer.from("fake-image")),
    /Gemini API error: Invalid API key/
  );
});

test("Gemini vision provider rejects invalid JSON responses", async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "not valid json"
                }
              ]
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

  const provider = new GeminiVisionProvider({
    apiKey: "test-key",
    fetchImpl: fakeFetch
  });

  await assert.rejects(
    () => provider.analyzeImage(Buffer.from("fake-image")),
    /Gemini API returned invalid JSON metadata/
  );
});
