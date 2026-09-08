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

const relativePath =
  "data/images/defibrillator/df-001_defibrillator.jpg";

const absolutePath = path.resolve(relativePath);

const image = await createImage({
  filename: relativePath,
  category: "defibrillator"
});

console.log("Created image:");
console.log({
  id: image.id,
  filename: image.filename,
  category: image.category,
  status: image.status
});

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

  imageLoader: async () => {
    return fs.readFile(absolutePath);
  },

  embeddingModel:
    process.env.EMBEDDING_MODEL || "gemini-embedding-001",

  embeddingModelVersion:
    process.env.EMBEDDING_MODEL_VERSION || "live",

  visionModel:
    process.env.VISION_MODEL || "gemini-3.6-flash"
});

try {
  const result = await service.processImage(image.id);

  console.log("\nSMOKE TEST RESULT");
  console.log(JSON.stringify({
    image: result.image,
    metadata: result.metadata,
    embedding: {
      id: result.embedding.id,
      image_id: result.embedding.image_id,
      model: result.embedding.model,
      model_version: result.embedding.model_version,
      dimensions: result.embedding.embedding?.length
    },
    lowConfidence: result.lowConfidence
  }, null, 2));

  console.log("\nSmoke test completed successfully.");
} catch (error) {
  console.error("\nSMOKE TEST FAILED");
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}


