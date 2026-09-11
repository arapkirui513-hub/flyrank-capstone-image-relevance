function calculateEstimatedCostUsd({
  inputTokens,
  outputTokens,
  inputCostPerMillion,
  outputCostPerMillion
}) {
  if (inputTokens === null && outputTokens === null) {
    return null;
  }

  if (
    typeof inputCostPerMillion !== "number" ||
    typeof outputCostPerMillion !== "number"
  ) {
    return null;
  }

  const inputCost =
    ((inputTokens ?? 0) / 1_000_000) *
    inputCostPerMillion;

  const outputCost =
    ((outputTokens ?? 0) / 1_000_000) *
    outputCostPerMillion;

  return inputCost + outputCost;
}

export class PostEmbeddingService {
  constructor({
    postRepository,
    postEmbeddingRepository,
    aiCostLogRepository,
    embeddingProvider,
    embeddingModel,
    embeddingModelVersion,
    embeddingProviderName = "unknown",
    embeddingInputCostPerMillion = null,
    embeddingOutputCostPerMillion = null,
    now = () => new Date()
  }) {
    this.postRepository = postRepository;
    this.postEmbeddingRepository = postEmbeddingRepository;
    this.aiCostLogRepository = aiCostLogRepository;
    this.embeddingProvider = embeddingProvider;
    this.embeddingModel = embeddingModel;
    this.embeddingModelVersion = embeddingModelVersion;
    this.embeddingProviderName = embeddingProviderName;
    this.embeddingInputCostPerMillion =
      embeddingInputCostPerMillion;
    this.embeddingOutputCostPerMillion =
      embeddingOutputCostPerMillion;
    this.now = now;
  }

  async embedPost(postId) {
    const post = await this.postRepository.findPostById(postId);

    if (!post) {
      throw new Error(`Post not found: ${postId}`);
    }

    const startedAt = this.now();

    let embeddingResult;

    try {
      embeddingResult =
        await this.embeddingProvider.embedText(
          post.content
        );
    } catch (error) {
      await this.logAiCall({
        operation: "embedding_generation",
        provider: this.embeddingProviderName,
        model: this.embeddingModel,
        inputTokens: null,
        outputTokens: null,
        startedAt,
        success: false,
        errorMessage: error.message
      });

      throw error;
    }

    await this.logAiCall({
      operation: "embedding_generation",
      provider: this.embeddingProviderName,
      model: this.embeddingModel,
      inputTokens:
        embeddingResult?.usage?.inputTokens ?? null,
      outputTokens:
        embeddingResult?.usage?.outputTokens ?? null,
      startedAt,
      success: true
    });

    const embedding = embeddingResult?.data;

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

  async logAiCall({
    operation,
    provider,
    model,
    inputTokens = null,
    outputTokens = null,
    startedAt,
    success,
    errorMessage = null
  }) {
    if (!this.aiCostLogRepository) {
      return;
    }

    const durationMs = Math.max(
      0,
      this.now().getTime() - startedAt.getTime()
    );

    const estimatedCostUsd =
      calculateEstimatedCostUsd({
        inputTokens,
        outputTokens,
        inputCostPerMillion:
          this.embeddingInputCostPerMillion,
        outputCostPerMillion:
          this.embeddingOutputCostPerMillion
      });

    await this.aiCostLogRepository.createAiCostLog({
      jobId: null,
      operation,
      provider,
      model,
      inputTokens,
      outputTokens,
      durationMs,
      estimatedCostUsd,
      success,
      errorMessage
    });
  }
}
