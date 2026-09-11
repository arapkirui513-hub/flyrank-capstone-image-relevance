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
import { GroqVisionProvider } from "./services/providers/groq-vision-provider.js";

function getOptionalNumber(value) {
  if (value === undefined || value === null || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

const embeddingModel =
  process.env.EMBEDDING_MODEL || "gemini-embedding-001";

const embeddingModelVersion =
  process.env.EMBEDDING_MODEL_VERSION || "1";

const visionProviderName =
  process.env.VISION_PROVIDER || "gemini";

const visionModel =
  visionProviderName === "groq"
    ? process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b"
    : process.env.VISION_MODEL || "gemini-3.6-flash";

const visionInputCostPerMillion =
  visionProviderName === "groq"
    ? getOptionalNumber(
        process.env.GROQ_VISION_INPUT_COST_PER_MILLION
      )
    : getOptionalNumber(
        process.env.GEMINI_VISION_INPUT_COST_PER_MILLION
      );

const visionOutputCostPerMillion =
  visionProviderName === "groq"
    ? getOptionalNumber(
        process.env.GROQ_VISION_OUTPUT_COST_PER_MILLION
      )
    : getOptionalNumber(
        process.env.GEMINI_VISION_OUTPUT_COST_PER_MILLION
      );

const embeddingInputCostPerMillion =
  getOptionalNumber(
    process.env.GEMINI_EMBEDDING_INPUT_COST_PER_MILLION
  );

const embeddingOutputCostPerMillion =
  getOptionalNumber(
    process.env.GEMINI_EMBEDDING_OUTPUT_COST_PER_MILLION
  );

const guardVersion =
  process.env.GUARD_VERSION || "1";

const embeddingProvider =
  new GeminiEmbeddingProvider({
    apiKey: process.env.GEMINI_API_KEY,
    model: embeddingModel
  });

const visionProvider =
  visionProviderName === "groq"
    ? new GroqVisionProvider({
        apiKey: process.env.GROQ_API_KEY,
        model:
          process.env.GROQ_VISION_MODEL ||
          "qwen/qwen3.6-27b"
      })
    : new GeminiVisionProvider({
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
    aiCostLogRepository,
    embeddingProvider,
    embeddingModel,
    embeddingModelVersion,
    embeddingProviderName: "gemini",
    embeddingInputCostPerMillion,
    embeddingOutputCostPerMillion
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
    visionModel,
    visionProviderName,
    embeddingProviderName: "gemini",
    visionInputCostPerMillion,
    visionOutputCostPerMillion,
    embeddingInputCostPerMillion,
    embeddingOutputCostPerMillion
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
