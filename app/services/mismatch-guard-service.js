import {
  GUARD_DECISIONS,
  REJECTION_REASONS,
  THRESHOLDS
} from "../domain/constants.js";
import { guardResultSchema } from "../domain/schemas.js";

function buildSubjectMismatchReason(expectedSubject, detectedSubject) {
  return REJECTION_REASONS.SUBJECT_MISMATCH
    .replace("{expected}", expectedSubject)
    .replace("{detected}", detectedSubject);
}

export class MismatchGuardService {
  evaluate({
    expectedSubject,
    detectedSubject,
    confidence,
    similarityScore
  }) {
    if (confidence < THRESHOLDS.MIN_CONFIDENCE) {
      return guardResultSchema.parse({
        decision: GUARD_DECISIONS.NO_CONFIDENT_MATCH,
        similarityScore,
        reason: REJECTION_REASONS.LOW_CONFIDENCE
      });
    }

    if (
      similarityScore === null ||
      similarityScore < THRESHOLDS.SIMILARITY_THRESHOLD
    ) {
      return guardResultSchema.parse({
        decision: GUARD_DECISIONS.REJECTED,
        similarityScore,
        reason: REJECTION_REASONS.SIMILARITY_BELOW_THRESHOLD
      });
    }

    if (expectedSubject !== detectedSubject) {
      return guardResultSchema.parse({
        decision: GUARD_DECISIONS.REJECTED,
        similarityScore,
        reason: buildSubjectMismatchReason(
          expectedSubject,
          detectedSubject
        )
      });
    }

    return guardResultSchema.parse({
      decision: GUARD_DECISIONS.ACCEPTED,
      similarityScore,
      reason: null
    });
  }
}
