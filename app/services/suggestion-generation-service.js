import { GUARD_DECISIONS } from "../domain/constants.js";

export class SuggestionGenerationService {
  constructor({
    matchingService,
    mismatchGuardService,
    suggestionRepository,
    guardVersion
  }) {
    this.matchingService = matchingService;
    this.mismatchGuardService = mismatchGuardService;
    this.suggestionRepository = suggestionRepository;
    this.guardVersion = guardVersion;
  }

  async generateForPost(
    postId,
    { expectedSubject, limit = 10 } = {}
  ) {
    const candidates = await this.matchingService.matchPost(postId, {
      limit
    });

    const results = [];

    for (const candidate of candidates) {
      const guardResult = this.mismatchGuardService.evaluate({
        expectedSubject,
        detectedSubject: candidate.subject,
        confidence: candidate.confidence,
        similarityScore: candidate.similarity
      });

      if (
        guardResult.decision ===
        GUARD_DECISIONS.NO_CONFIDENT_MATCH
      ) {
        results.push({
          ...candidate,
          guardDecision: guardResult.decision,
          rejectionReason: guardResult.reason,
          suggestion: null
        });

        continue;
      }

      const suggestion =
        await this.suggestionRepository.createSuggestion({
          postId,
          imageId: candidate.imageId,
          similarityScore: guardResult.similarityScore,
          guardDecision: guardResult.decision,
          rejectionReason: guardResult.reason,
          guardVersion: this.guardVersion
        });

      results.push({
        ...candidate,
        guardDecision: guardResult.decision,
        rejectionReason: guardResult.reason,
        suggestion
      });
    }

    return results;
  }
}

export default SuggestionGenerationService;
