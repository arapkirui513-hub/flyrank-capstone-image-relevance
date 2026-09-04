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

    const imageEmbeddings =
      await this.imageEmbeddingRepository.findAllImageEmbeddings();

    if (imageEmbeddings.length === 0) {
      return [];
    }

    const results = imageEmbeddings.map((imageEmbedding) => ({
      imageId: imageEmbedding.image_id,
      similarityScore: cosineSimilarity(
        postEmbedding.embedding,
        imageEmbedding.embedding
      )
    }));

    results.sort(
      (a, b) => b.similarityScore - a.similarityScore
    );

    return results.slice(0, limit);
  }
}
