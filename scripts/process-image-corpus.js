import fs from "node:fs/promises";
import path from "node:path";

import { pool } from "../app/db/pool.js";
import { createImage } from "../app/repositories/image-repository.js";
import { createImageMetadata } from "../app/repositories/image-metadata-repository.js";
import { createImageEmbedding } from "../app/repositories/image-embedding-repository.js";
import { createAiCostLog } from "../app/repositories/ai-cost-log-repository.js";
import { ImageProcessingService } from "../app/services/image-processing-service.js";
import { GeminiVisionProvider } from "../app/services/providers/gemini-vision-provider.js";
import GeminiEmbeddingProvider from "../app/services/providers/gemini-embedding-provider.js";

const imageRoot = path.resolve("data/images");

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

console.log("\nIMAGE CORPUS PROCESSING");
console.log(`Discovered: ${imagePaths.length}`);

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

  visionProvider: new GeminiVisionProvider(),
  embeddingProvider: new GeminiEmbeddingProvider(),

  imageLoader: async (image) => {
    return fs.readFile(path.resolve(image.filename));
  },

  embeddingModel:
    process.env.EMBEDDING_MODEL || "gemini-embedding-001",

  embeddingModelVersion:
    process.env.EMBEDDING_MODEL_VERSION || "live",

  visionModel:
    process.env.VISION_MODEL || "gemini-3.6-flash"
});

const results = [];

for (const absolutePath of imagePaths) {
  const relativePath = path.relative(process.cwd(), absolutePath);
  const category = path.basename(path.dirname(absolutePath));

  console.log(`\nProcessing: ${relativePath}`);

  try {
    const image = await createImage({
      filename: relativePath,
      category
    });

    const result = await service.processImage(image.id);

    results.push({
      category,
      filename: relativePath,
      success: true,
      status: result.image.status,
      confidence: result.metadata.confidence,
      embeddingDimensions: result.embedding.embedding?.length
    });

    console.log(
      `? completed | confidence=${result.metadata.confidence} | embedding=${result.embedding.embedding?.length}`
    );
  } catch (error) {
    results.push({
      category,
      filename: relativePath,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });

    console.error(
      `? failed | ${error instanceof Error ? error.message : String(error)}`
    );
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
