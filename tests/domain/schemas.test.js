import assert from "node:assert/strict";
import test from "node:test";

import {
  visionMetadataSchema,
  guardResultSchema
} from "../../app/domain/schemas.js";

test("vision metadata schema accepts valid metadata", () => {
  const result = visionMetadataSchema.safeParse({
    subject: "patient monitor",
    category: "medical_equipment",
    attributes: ["screen", "vital signs display"],
    caption: "A patient monitor displaying vital signs.",
    confidence: 0.92
  });

  assert.equal(result.success, true);
});

test("vision metadata schema rejects confidence outside 0 to 1", () => {
  const result = visionMetadataSchema.safeParse({
    subject: "patient monitor",
    category: "medical_equipment",
    attributes: [],
    caption: "A patient monitor.",
    confidence: 1.2
  });

  assert.equal(result.success, false);
});

test("vision metadata schema rejects invalid attributes", () => {
  const result = visionMetadataSchema.safeParse({
    subject: "patient monitor",
    category: "medical_equipment",
    attributes: "screen",
    caption: "A patient monitor.",
    confidence: 0.8
  });

  assert.equal(result.success, false);
});

test("guard result schema accepts accepted result", () => {
  const result = guardResultSchema.safeParse({
    decision: "accepted",
    similarityScore: 0.87,
    reason: null
  });

  assert.equal(result.success, true);
});

test("guard result schema accepts nullable similarity and reason", () => {
  const result = guardResultSchema.safeParse({
    decision: "no_confident_match",
    similarityScore: null,
    reason: "Vision model confidence below minimum threshold."
  });

  assert.equal(result.success, true);
});

test("guard result schema rejects unknown decision", () => {
  const result = guardResultSchema.safeParse({
    decision: "unknown",
    similarityScore: 0.5,
    reason: "Unknown decision."
  });

  assert.equal(result.success, false);
});