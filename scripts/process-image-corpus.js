import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

import { pool } from "../app/db/pool.js";
import { createImage, findImageByFilename } from "../app/repositories/image-repository.js";
import { createImageMetadata } from "../app/repositories/image-metadata-repository.js";
import { createImageEmbedding } from "../app/repositories/image-embedding-repository.js";
import { createAiCostLog } from "../app/repositories/ai-cost-log-repository.js";
import { ImageProcessingService } from "../app/services/image-processing-service.js";
import { GeminiVisionProvider } from "../app/services/providers/gemini-vision-provider.js";
import { GroqVisionProvider } from "../app/services/providers/groq-vision-provider.js";
import GeminiEmbeddingProvider from "../app/services/providers/gemini-embedding-provider.js";

function getOptionalNumber(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const imageRoot = path.resolve(
  process.env.IMAGE_ROOT || "data/images"
);

const imageExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
]);

async function discoverImages(directory) {
  const entries = await fs.readdir(directory, {
    withFileTypes: true
  });

  const images = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      images.push(...await discoverImages(fullPath));
      continue;
    }

    if (imageExtensions.has(path.extname(entry.name).toLowerCase())) {
      images.push(fullPath);
    }
  }

  return images.sort();
}

const imagePaths = await discoverImages(imageRoot);

const categoryFilter =
  (process.env.IMAGE_CATEGORY || "").trim().toLowerCase();

const selectedImagePaths = categoryFilter
  ? imagePaths.filter(
      (imagePath) =>
        path.basename(path.dirname(imagePath)).toLowerCase() ===
        categoryFilter
    )
  : imagePaths;

const imageLimit = Number.parseInt(process.env.IMAGE_LIMIT || "", 10);

const limitedImagePaths =
  Number.isFinite(imageLimit) && imageLimit > 0
    ? selectedImagePaths.slice(0, imageLimit)
    : selectedImagePaths;

const visionProviderName =
  (process.env.VISION_PROVIDER || "gemini").toLowerCase();

const visionProvider =
  visionProviderName === "groq"
    ? new GroqVisionProvider()
    : new GeminiVisionProvider();

const visionModel =
  visionProviderName === "groq"
    ? process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b"
    : process.env.VISION_MODEL || "gemini-3.6-flash";

console.log("\nIMAGE CORPUS PROCESSING");
console.log(`Discovered: ${imagePaths.length}`);
console.log(
  `Category filter: ${categoryFilter || "none"}`
);
console.log(`Selected: ${limitedImagePaths.length}`);
console.log(`Vision provider: ${visionProviderName}`);
console.log(`Vision model: ${visionModel}`);
console.log(
  `Embedding model: ${
    process.env.EMBEDDING_MODEL || "gemini-embedding-001"
  }`
);

const service = new ImageProcessingService({
  imageRepository: {
    async findImageById(id) {
      const result = await pool.query(
        `
          SELECT
            id,
            filename,
            category,
            status,
            created_at,
            updated_at
          FROM images
          WHERE id = $1
        `,
        [id]
      );

      return result.rows[0] ?? null;
    },

    async updateImageStatus(id, status) {
      const result = await pool.query(
        `
          UPDATE images
          SET
            status = $2,
            updated_at = NOW()
          WHERE id = $1
          RETURNING
            id,
            filename,
            category,
            status,
            created_at,
            updated_at
        `,
        [id, status]
      );

      return result.rows[0] ?? null;
    }
  },

  imageMetadataRepository: {
    createImageMetadata
  },

  imageEmbeddingRepository: {
    createImageEmbedding
  },

  aiCostLogRepository: {
    createAiCostLog
  },

  visionProvider,
  embeddingProvider: new GeminiEmbeddingProvider(),

  imageLoader: async (image) => {
    return fs.readFile(path.resolve(image.filename));
  },

  embeddingModel:
    process.env.EMBEDDING_MODEL || "gemini-embedding-001",

  embeddingModelVersion:
    process.env.EMBEDDING_MODEL_VERSION || "live",

  visionProviderName,
  embeddingProviderName: "gemini",
  visionInputCostPerMillion: getOptionalNumber(
    visionProviderName === "groq"
      ? process.env.GROQ_VISION_INPUT_COST_PER_MILLION
      : process.env.GEMINI_VISION_INPUT_COST_PER_MILLION
  ),

  visionOutputCostPerMillion: getOptionalNumber(
    visionProviderName === "groq"
      ? process.env.GROQ_VISION_OUTPUT_COST_PER_MILLION
      : process.env.GEMINI_VISION_OUTPUT_COST_PER_MILLION
  ),

  embeddingInputCostPerMillion: getOptionalNumber(
    process.env.GEMINI_EMBEDDING_INPUT_COST_PER_MILLION
  ),

  embeddingOutputCostPerMillion: getOptionalNumber(
    process.env.GEMINI_EMBEDDING_OUTPUT_COST_PER_MILLION
  ),

  visionModel
});

const results = [];

function isQuotaOrRateLimitError(error) {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();

  return (
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("rate-limit") ||
    message.includes("429") ||
    message.includes("resource_exhausted")
  );
}

function getRetryDelayMs(error) {
  const message =
    error instanceof Error ? error.message : String(error);

  const secondsMatch = message.match(
    /try again in ([\d.]+)s/i
  );

  if (secondsMatch) {
    return Math.ceil(Number(secondsMatch[1]) * 1000) + 500;
  }

  const millisecondsMatch = message.match(
    /try again in ([\d.]+)ms/i
  );

  if (millisecondsMatch) {
    return Math.ceil(Number(millisecondsMatch[1])) + 500;
  }

  return 15000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RATE_LIMIT_RETRIES = 3;

async function processImageWithRateLimitRetry(imageId) {
  for (let attempt = 1; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    try {
      return await service.processImage(imageId);
    } catch (error) {
      if (
        !isQuotaOrRateLimitError(error) ||
        attempt === MAX_RATE_LIMIT_RETRIES
      ) {
        throw error;
      }

      const delayMs = getRetryDelayMs(error);

      console.error(
        `RATE LIMIT | attempt ${attempt}/${MAX_RATE_LIMIT_RETRIES} | waiting ${delayMs}ms`
      );

      await sleep(delayMs);
    }
  }

  throw new Error("Image processing retry loop exited unexpectedly.");
}

for (const absolutePath of limitedImagePaths) {
  const relativePath = path.relative(process.cwd(), absolutePath);
  const normalizedPath = relativePath.split(path.sep).join("/");
  const category = path.basename(path.dirname(absolutePath));

  console.log(`\nProcessing: ${normalizedPath}`);

  try {
    let image = await findImageByFilename(normalizedPath);

    if (image?.status === "completed") {
      console.log(`SKIP | already completed`);

      results.push({
        category,
        filename: normalizedPath,
        success: true,
        status: "completed",
        skipped: true
      });

      continue;
    }

    if (!image) {
      image = await createImage({
        filename: normalizedPath,
        category
      });

      console.log(`Created image record`);
    } else {
      console.log(`Reusing existing image | status=${image.status}`);
    }

    const result = await processImageWithRateLimitRetry(image.id);

    results.push({
      category,
      filename: normalizedPath,
      success: true,
      status: result.image.status,
      confidence: result.metadata.confidence,
      embeddingDimensions: result.embedding.embedding?.length
    });

        console.log(
      `completed | confidence=${result.metadata.confidence} | embedding=${result.embedding.embedding?.length}`
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    console.error(`failed | ${message}`);

    results.push({
      category,
      filename: normalizedPath,
      success: false,
      error: message
    });

    if (isQuotaOrRateLimitError(error)) {
  const retryDelayMs = getRetryDelayMs(error);

  console.error(
    `RATE LIMIT | waiting ${retryDelayMs}ms before continuing.`
  );

  await sleep(retryDelayMs);
}
  }
}

const completed = results.filter((result) => result.success);
const failed = results.filter((result) => !result.success);

const categorySummary = {};

for (const result of results) {
  if (!categorySummary[result.category]) {
    categorySummary[result.category] = {
      total: 0,
      completed: 0,
      failed: 0
    };
  }

  categorySummary[result.category].total += 1;

  if (result.success) {
    categorySummary[result.category].completed += 1;
  } else {
    categorySummary[result.category].failed += 1;
  }
}

console.log("\nCORPUS SUMMARY");
console.log(`Discovered: ${imagePaths.length}`);
console.log(`Completed:  ${completed.length}`);
console.log(`Failed:     ${failed.length}`);

console.log("\nBY CATEGORY");

for (const [category, summary] of Object.entries(categorySummary)) {
  console.log(
    `${category}: ${summary.completed}/${summary.total} completed`
  );
}

if (failed.length > 0) {
  console.log("\nFAILED IMAGES");

  for (const result of failed) {
    console.log(`- ${result.filename}`);
    console.log(`  ${result.error}`);
  }
}

await pool.end();

if (failed.length > 0) {
  process.exitCode = 1;
}




