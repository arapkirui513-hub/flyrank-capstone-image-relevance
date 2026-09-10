import { readFile } from "node:fs/promises";
import path from "node:path";

import * as imageRepository from "./repositories/image-repository.js";
import * as imageMetadataRepository from "./repositories/image-metadata-repository.js";
import * as imageEmbeddingRepository from "./repositories/image-embedding-repository.js";
import * as aiCostLogRepository from "./repositories/ai-cost-log-repository.js";
import * as jobRepository from "./repositories/job-repository.js";
import * as postRepository from "./repositories/post-repository.js";
import * as postEmbeddingRepository from "./repositories/post-embedding-repository.js";
import * as suggestionRepository from "./repositories/suggestion-repository.js";

import { ImageProcessingService } from "./services/image-processing-service.js";
import { ImageProcessingJobService } from "./services/image-processing-job-service.js";
import { MatchingService } from "./services/matching-service.js";
import { PostEmbeddingService } from "./services/post-embedding-service.js";
import MismatchGuardService from "./services/mismatch-guard-service.js";
import SuggestionGenerationService from "./services/suggestion-generation-service.js";

import GeminiEmbeddingProvider from "./services/providers/gemini-embedding-provider.js";
import { GeminiVisionProvider } from "./services/providers/gemini-vision-provider.js";

const embeddingModel =
  process.env.EMBEDDING_MODEL || "gemini-embedding-001";

const embeddingModelVersion =
  process.env.EMBEDDING_MODEL_VERSION || "1";

const visionModel =
  process.env.VISION_MODEL || "gemini-3.6-flash";

const guardVersion =
  process.env.GUARD_VERSION || "1";

const embeddingProvider =
  new GeminiEmbeddingProvider(
    process.env.GEMINI_API_KEY,
    embeddingModel
  );

const visionProvider =
  new GeminiVisionProvider({
    apiKey: process.env.GEMINI_API_KEY,
    model: visionModel
  });

const imageLoader = async (image) => {
  const imagePath = path.resolve(image.filename);

  return readFile(imagePath);
};

const postEmbeddingService =
  new PostEmbeddingService({
    postRepository,
    postEmbeddingRepository,
    embeddingProvider,
    embeddingModel,
    embeddingModelVersion
  });

const imageProcessingService =
  new ImageProcessingService({
    imageRepository,
    imageMetadataRepository,
    imageEmbeddingRepository,
    aiCostLogRepository,
    visionProvider,
    embeddingProvider,
    imageLoader,
    embeddingModel,
    embeddingModelVersion,
    visionModel
  });

const imageProcessingJobService =
  new ImageProcessingJobService({
    jobRepository,
    imageRepository,
    imageProcessingService
  });

const matchingService =
  new MatchingService({
    postEmbeddingRepository,
    imageEmbeddingRepository,
    model: embeddingModel,
    modelVersion: embeddingModelVersion
  });

const mismatchGuardService =
  new MismatchGuardService();

const suggestionGenerationService =
  new SuggestionGenerationService({
    matchingService,
    mismatchGuardService,
    suggestionRepository,
    guardVersion
  });

export {
  imageProcessingService,
  imageProcessingJobService,
  postRepository,
  postEmbeddingService,
  suggestionGenerationService
};
