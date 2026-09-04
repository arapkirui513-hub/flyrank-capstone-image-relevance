import { cosineSimilarity } from "../domain/similarity.js";

export class MatchingService {
  constructor({
    postEmbeddingRepository,
    imageEmbeddingRepository,
    model,
    modelVersion
  }) {
    this.postEmbeddingRepository = postEmbeddingRepository;
    this.imageEmbeddingRepository = imageEmbeddingRepository;
    this.model = model;
    this.modelVersion = modelVersion;
  }

  async matchPost(postId, { limit = 10 } = {}) {
    const postEmbedding =
      await this.postEmbeddingRepository.findPostEmbedding({
        postId,
        model: this.model,
        modelVersion: this.modelVersion
      });

    if (!postEmbedding) {
      return [];
    }

    const candidates =
      await this.imageEmbeddingRepository
        .findImageEmbeddingsWithMetadata({
          model: this.model,
          modelVersion: this.modelVersion
        });

    if (candidates.length === 0) {
      return [];
    }

    const ranked = candidates
      .map((candidate) => ({
        imageId: candidate.image_id,
        subject: candidate.subject,
        category: candidate.category,
        confidence: Number(candidate.confidence),
        similarity: cosineSimilarity(
          postEmbedding.embedding,
          candidate.embedding
        )
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return ranked;
  }
}