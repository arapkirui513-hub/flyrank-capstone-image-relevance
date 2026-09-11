import { visionMetadataSchema } from "../domain/schemas.js";
import { THRESHOLDS } from "../domain/constants.js";

function getImageMimeType(filename) {
  const extension = filename.toLowerCase().split(".").pop();

  const mimeTypes = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp"
  };

  const mimeType = mimeTypes[extension];

  if (!mimeType) {
    throw new Error(`Unsupported image format: ${extension}`);
  }

  return mimeType;
}

function calculateEstimatedCostUsd({
  inputTokens,
  outputTokens,
  inputCostPerMillion,
  outputCostPerMillion
}) {
  if (
    inputTokens === null &&
    outputTokens === null
  ) {
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

export class ImageProcessingService {
  constructor({
    imageRepository,
    imageMetadataRepository,
    imageEmbeddingRepository,
    aiCostLogRepository,
    visionProvider,
    embeddingProvider,
    imageLoader,
    embeddingModel,
    embeddingModelVersion,
    visionModel = "unknown",
    visionProviderName = "unknown",
    embeddingProviderName = "unknown",
    visionInputCostPerMillion = null,
    visionOutputCostPerMillion = null,
    embeddingInputCostPerMillion = null,
    embeddingOutputCostPerMillion = null,
    now = () => new Date()
  }) {
    this.imageRepository = imageRepository;
    this.imageMetadataRepository = imageMetadataRepository;
    this.imageEmbeddingRepository = imageEmbeddingRepository;
    this.aiCostLogRepository = aiCostLogRepository;
    this.visionProvider = visionProvider;
    this.embeddingProvider = embeddingProvider;
    this.imageLoader = imageLoader;
    this.embeddingModel = embeddingModel;
    this.embeddingModelVersion = embeddingModelVersion;
    this.visionModel = visionModel;
    this.visionProviderName = visionProviderName;
    this.embeddingProviderName = embeddingProviderName;
    this.visionInputCostPerMillion =
      visionInputCostPerMillion;
    this.visionOutputCostPerMillion =
      visionOutputCostPerMillion;
    this.embeddingInputCostPerMillion =
      embeddingInputCostPerMillion;
    this.embeddingOutputCostPerMillion =
      embeddingOutputCostPerMillion;
    this.now = now;
  }

  async processImage(imageId, { jobId = null } = {}) {
    const image = await this.imageRepository.findImageById(imageId);

    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    await this.imageRepository.updateImageStatus(
      imageId,
      "processing"
    );

    try {
      const imageBuffer = await this.imageLoader(image);

      const visionStartedAt = this.now();

      let visionResult;

      try {
        visionResult =
          await this.visionProvider.analyzeImage(
            imageBuffer,
            getImageMimeType(image.filename)
          );
      } catch (error) {
        await this.logAiCall({
          jobId,
          operation: "vision_analysis",
          provider: this.visionProviderName,
          model: this.visionModel,
          inputTokens: null,
          outputTokens: null,
          startedAt: visionStartedAt,
          success: false,
          errorMessage: error.message
        });

        throw error;
      }

      await this.logAiCall({
        jobId,
        operation: "vision_analysis",
        provider: this.visionProviderName,
        model: this.visionModel,
        inputTokens:
          visionResult?.usage?.inputTokens ?? null,
        outputTokens:
          visionResult?.usage?.outputTokens ?? null,
        startedAt: visionStartedAt,
        success: true
      });

      const metadata = visionMetadataSchema.parse(
        visionResult?.data
      );

      const embeddingStartedAt = this.now();

      let embeddingResult;

      try {
        embeddingResult =
          await this.embeddingProvider.embedText(
            metadata.caption
          );
      } catch (error) {
        await this.logAiCall({
          jobId,
          operation: "embedding_generation",
          provider: this.embeddingProviderName,
          model: this.embeddingModel,
          inputTokens: null,
          outputTokens: null,
          startedAt: embeddingStartedAt,
          success: false,
          errorMessage: error.message
        });

        throw error;
      }

      await this.logAiCall({
        jobId,
        operation: "embedding_generation",
        provider: this.embeddingProviderName,
        model: this.embeddingModel,
        inputTokens:
          embeddingResult?.usage?.inputTokens ?? null,
        outputTokens:
          embeddingResult?.usage?.outputTokens ?? null,
        startedAt: embeddingStartedAt,
        success: true
      });

      const embedding = embeddingResult?.data;

      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error(
          "Embedding provider returned an invalid embedding."
        );
      }

      const savedMetadata =
        await this.imageMetadataRepository.createImageMetadata({
          imageId,
          subject: metadata.subject,
          category: metadata.category,
          attributes: metadata.attributes,
          caption: metadata.caption,
          confidence: metadata.confidence
        });

      const savedEmbedding =
        await this.imageEmbeddingRepository.createImageEmbedding({
          imageId,
          model: this.embeddingModel,
          modelVersion: this.embeddingModelVersion,
          embedding
        });

      const completedImage =
        await this.imageRepository.updateImageStatus(
          imageId,
          "completed"
        );

      return {
        image: completedImage,
        metadata: savedMetadata,
        embedding: savedEmbedding,
        lowConfidence:
          metadata.confidence < THRESHOLDS.MIN_CONFIDENCE
      };
    } catch (error) {
      await this.imageRepository.updateImageStatus(
        imageId,
        "failed"
      );

      throw error;
    }
  }

  async logAiCall({
    jobId = null,
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

    let estimatedCostUsd = null;

    if (operation === "vision_analysis") {
      estimatedCostUsd = calculateEstimatedCostUsd({
        inputTokens,
        outputTokens,
        inputCostPerMillion:
          this.visionInputCostPerMillion,
        outputCostPerMillion:
          this.visionOutputCostPerMillion
      });
    }

    if (operation === "embedding_generation") {
      estimatedCostUsd = calculateEstimatedCostUsd({
        inputTokens,
        outputTokens,
        inputCostPerMillion:
          this.embeddingInputCostPerMillion,
        outputCostPerMillion:
          this.embeddingOutputCostPerMillion
      });
    }

    await this.aiCostLogRepository.createAiCostLog({
      jobId,
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
