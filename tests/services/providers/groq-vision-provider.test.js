import assert from "node:assert/strict";
import test from "node:test";
import { GroqVisionProvider } from "../../../app/services/providers/groq-vision-provider.js";

test("Groq vision provider implements analyzeImage contract", async () => {
  const fakeFetch = async (url, options) => {
    assert.equal(
      url,
      "https://api.groq.com/openai/v1/chat/completions"
    );

    const body = JSON.parse(options.body);

    assert.equal(body.model, "qwen/qwen3.6-27b");
    assert.equal(body.temperature, 0);


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
        ],
        usage: {
          prompt_tokens: 120,
          completion_tokens: 80
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

  const provider = new GroqVisionProvider({
    apiKey: "test-key",
    fetchImpl: fakeFetch
  });

  const result = await provider.analyzeImage(
    Buffer.from("fake-image")
  );

  assert.deepEqual(result, {
    data: {
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
    },
    usage: {
      inputTokens: 120,
      outputTokens: 80
    }
  });
});

test("Groq vision provider preserves missing usage as null", async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                subject: "patient monitor",
                category: "medical_equipment",
                attributes: ["display"],
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

  const provider = new GroqVisionProvider({
    apiKey: "test-key",
    fetchImpl: fakeFetch
  });

  const result = await provider.analyzeImage(
    Buffer.from("fake-image")
  );

  assert.deepEqual(result.usage, {
    inputTokens: null,
    outputTokens: null
  });
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
    apiKey: "test-key",
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

test("Groq vision provider rejects missing response content", async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({
        choices: []
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
    /Groq API returned no response content/
  );
});

test("GroqVisionProvider requires an API key", () => {
  assert.throws(
    () =>
      new GroqVisionProvider({
        apiKey: ""
      }),
    /GROQ_API_KEY is required/
  );
});

test("GroqVisionProvider requires a Buffer", async () => {
  const provider = new GroqVisionProvider({
    apiKey: "test-key"
  });

  await assert.rejects(
    () => provider.analyzeImage("not-a-buffer"),
    /imageBuffer must be a Buffer/
  );
});

test("GroqVisionProvider rejects empty image buffers", async () => {
  const provider = new GroqVisionProvider({
    apiKey: "test-key"
  });

  await assert.rejects(
    () => provider.analyzeImage(Buffer.alloc(0)),
    /imageBuffer must not be empty/
  );
});
