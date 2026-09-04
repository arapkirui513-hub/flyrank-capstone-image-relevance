import assert from "node:assert/strict";
import test from "node:test";

import { VisionProvider } from "../../../app/services/providers/vision-provider.js";
import { EmbeddingProvider } from "../../../app/services/providers/embedding-provider.js";
import { MockVisionProvider } from "../../../app/services/providers/mock/mock-vision-provider.js";
import { MockEmbeddingProvider } from "../../../app/services/providers/mock/mock-embedding-provider.js";

test("vision provider exposes analyzeImage contract", async () => {
  const provider = new MockVisionProvider();

  assert.equal(typeof provider.analyzeImage, "function");

  const result = await provider.analyzeImage(Buffer.from("test"));

  assert.equal(result.subject, "patient monitor");
  assert.equal(result.category, "medical_equipment");
  assert.ok(Array.isArray(result.attributes));
  assert.equal(typeof result.caption, "string");
  assert.equal(typeof result.confidence, "number");
});

test("embedding provider exposes embedText contract", async () => {
  const provider = new MockEmbeddingProvider();

  assert.equal(typeof provider.embedText, "function");

  const result = await provider.embedText(
    "A patient monitor displaying vital signs."
  );

  assert.ok(Array.isArray(result));
  assert.deepEqual(result, [0.12, 0.34, 0.56, 0.78]);
});

test("base vision provider rejects unimplemented analyzeImage", async () => {
  const provider = new VisionProvider();

  await assert.rejects(
    () => provider.analyzeImage(Buffer.from("test")),
    /must be implemented by a provider/
  );
});

test("base embedding provider rejects unimplemented embedText", async () => {
  const provider = new EmbeddingProvider();

  await assert.rejects(
    () => provider.embedText("test"),
    /must be implemented by a provider/
  );
});
