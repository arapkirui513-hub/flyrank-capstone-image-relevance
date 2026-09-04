import { visionMetadataSchema } from "../domain/schemas.js";
import { THRESHOLDS } from "../domain/constants.js";

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
    this.now = now;
  }

  async processImage(imageId) {
    const image = await this.imageRepository.findImageById(imageId);

    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    await this.imageRepository.updateImageStatus(
      imageId,
      "processing"
    );

    const startedAt = this.now();

    try {
      const imageBuffer = await this.imageLoader(image);

      const rawMetadata =
        await this.visionProvider.analyzeImage(imageBuffer);

      const metadata = visionMetadataSchema.parse(rawMetadata);

      const embedding =
        await this.embeddingProvider.embedText(metadata.caption);

      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error(
          "Embedding provider returned an invalid embedding."
        );
      }

      const savedMetadata =
        await this.imageMetadataRepository.createImageMetadata({
          imageId,
          subject: metadata.subject,
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

      await this.logCost({
        startedAt,
        success: true
      });

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

      await this.logCost({
        startedAt,
        success: false,
        errorMessage: error.message
      });

      throw error;
    }
  }

  async logCost({
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

    await this.aiCostLogRepository.createAiCostLog({
      jobId: null,
      operation: "image_processing",
      provider: "ai",
      model: this.visionModel,
      inputTokens: null,
      outputTokens: null,
      durationMs,
      estimatedCostUsd: null,
      success,
      errorMessage
    });
  }
}
