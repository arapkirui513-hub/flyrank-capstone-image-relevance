export class PostEmbeddingService {
  constructor({
    postRepository,
    postEmbeddingRepository,
    embeddingProvider,
    embeddingModel,
    embeddingModelVersion
  }) {
    this.postRepository = postRepository;
    this.postEmbeddingRepository = postEmbeddingRepository;
    this.embeddingProvider = embeddingProvider;
    this.embeddingModel = embeddingModel;
    this.embeddingModelVersion = embeddingModelVersion;
  }

  async embedPost(postId) {
    const post = await this.postRepository.findPostById(postId);

    if (!post) {
      throw new Error(`Post not found: ${postId}`);
    }

    const embedding = await this.embeddingProvider.embedText(
      post.content
    );

    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error(
        "Embedding provider returned an invalid embedding."
      );
    }

    return this.postEmbeddingRepository.createPostEmbedding({
      postId,
      model: this.embeddingModel,
      modelVersion: this.embeddingModelVersion,
      embedding
    });
  }
}