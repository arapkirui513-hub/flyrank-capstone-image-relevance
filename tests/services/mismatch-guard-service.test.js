import assert from "node:assert/strict";
import test from "node:test";

import { GUARD_DECISIONS, REJECTION_REASONS } from "../../app/domain/constants.js";
import { MismatchGuardService } from "../../app/services/mismatch-guard-service.js";

const guard = new MismatchGuardService();

test("guard accepts a confident compatible subject with sufficient similarity", () => {
  const result = guard.evaluate({
    expectedSubject: "patient monitor",
    detectedSubject: "patient monitor",
    confidence: 0.92,
    similarityScore: 0.81
  });

  assert.deepEqual(result, {
    decision: GUARD_DECISIONS.ACCEPTED,
    similarityScore: 0.81,
    reason: null
  });
});

test("guard returns no confident match when vision confidence is below threshold", () => {
  const result = guard.evaluate({
    expectedSubject: "patient monitor",
    detectedSubject: "patient monitor",
    confidence: 0.69,
    similarityScore: 0.81
  });

  assert.deepEqual(result, {
    decision: GUARD_DECISIONS.NO_CONFIDENT_MATCH,
    similarityScore: 0.81,
    reason: REJECTION_REASONS.LOW_CONFIDENCE
  });
});

test("confidence check takes precedence over similarity check", () => {
  const result = guard.evaluate({
    expectedSubject: "patient monitor",
    detectedSubject: "patient monitor",
    confidence: 0.50,
    similarityScore: 0.20
  });

  assert.equal(
    result.decision,
    GUARD_DECISIONS.NO_CONFIDENT_MATCH
  );
  assert.equal(
    result.reason,
    REJECTION_REASONS.LOW_CONFIDENCE
  );
});

test("guard rejects similarity below threshold", () => {
  const result = guard.evaluate({
    expectedSubject: "patient monitor",
    detectedSubject: "patient monitor",
    confidence: 0.92,
    similarityScore: 0.64
  });

  assert.deepEqual(result, {
    decision: GUARD_DECISIONS.REJECTED,
    similarityScore: 0.64,
    reason: REJECTION_REASONS.SIMILARITY_BELOW_THRESHOLD
  });
});

test("guard rejects a null similarity score", () => {
  const result = guard.evaluate({
    expectedSubject: "patient monitor",
    detectedSubject: "patient monitor",
    confidence: 0.92,
    similarityScore: null
  });

  assert.deepEqual(result, {
    decision: GUARD_DECISIONS.REJECTED,
    similarityScore: null,
    reason: REJECTION_REASONS.SIMILARITY_BELOW_THRESHOLD
  });
});

test("guard rejects subject mismatch", () => {
  const result = guard.evaluate({
    expectedSubject: "patient monitor",
    detectedSubject: "defibrillator",
    confidence: 0.92,
    similarityScore: 0.81
  });

  assert.deepEqual(result, {
    decision: GUARD_DECISIONS.REJECTED,
    similarityScore: 0.81,
    reason:
      "Subject mismatch: expected patient monitor, detected defibrillator."
  });
});

test("guard applies similarity check before subject compatibility", () => {
  const result = guard.evaluate({
    expectedSubject: "patient monitor",
    detectedSubject: "defibrillator",
    confidence: 0.92,
    similarityScore: 0.40
  });

  assert.equal(result.decision, GUARD_DECISIONS.REJECTED);
  assert.equal(
    result.reason,
    REJECTION_REASONS.SIMILARITY_BELOW_THRESHOLD
  );
});

test("guard accepts values exactly at both thresholds", () => {
  const result = guard.evaluate({
    expectedSubject: "patient monitor",
    detectedSubject: "patient monitor",
    confidence: 0.70,
    similarityScore: 0.65
  });

  assert.deepEqual(result, {
    decision: GUARD_DECISIONS.ACCEPTED,
    similarityScore: 0.65,
    reason: null
  });
});
