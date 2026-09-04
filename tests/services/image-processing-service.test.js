import assert from "node:assert/strict";
import test from "node:test";

import { ImageProcessingService } from "../../app/services/image-processing-service.js";

function createDependencies(overrides = {}) {
  const calls = {
    statuses: [],
    metadata: [],
    embeddings: [],
    costs: []
  };

  const dependencies = {
    imageRepository: {
      async findImageById(id) {
        return {
          id,
          filename: "pm-001_patient-monitor.jpg",
          category: "patient_monitor",
          status: "pending"
        };
      },

      async updateImageStatus(id, status) {
        calls.statuses.push({ id, status });

        return {
          id,
          filename: "pm-001_patient-monitor.jpg",
          category: "patient_monitor",
          status
        };
      }
    },

    imageMetadataRepository: {
      async createImageMetadata(metadata) {
        calls.metadata.push(metadata);
        return metadata;
      }
    },

    imageEmbeddingRepository: {
      async createImageEmbedding(embedding) {
        calls.embeddings.push(embedding);
        return {
          id: "embedding-1",
          ...embedding
        };
      }
    },

    aiCostLogRepository: {
      async createAiCostLog(log) {
        calls.costs.push(log);
        return log;
      }
    },

    visionProvider: {
      async analyzeImage(imageBuffer) {
        assert.ok(Buffer.isBuffer(imageBuffer));

        return {
          subject: "patient monitor",
          category: "medical_equipment",
          attributes: ["bedside", "vital signs", "display"],
          caption: "A patient monitor displaying vital signs.",
          confidence: 0.92
        };
      }
    },

    embeddingProvider: {
      async embedText(text) {
        assert.equal(
          text,
          "A patient monitor displaying vital signs."
        );

        return [0.12, 0.34, 0.56, 0.78];
      }
    },

    imageLoader: async (image) => {
      assert.equal(image.filename, "pm-001_patient-monitor.jpg");
      assert.equal(image.category, "patient_monitor");

      return Buffer.from("fake-image");
    },

    embeddingModel: "mock-embedding",
    embeddingModelVersion: "v1",
    visionModel: "mock-vision",

    now: () => new Date("2026-09-04T09:00:00.000Z"),

    ...overrides
  };

  return {
    dependencies,
    calls
  };
}

test("image processing analyzes, embeds, persists, and completes an image", async () => {
  const { dependencies, calls } = createDependencies();

  const service = new ImageProcessingService(dependencies);

  const result = await service.processImage("image-1");

  assert.deepEqual(
    calls.statuses.map((call) => call.status),
    ["processing", "completed"]
  );

  assert.deepEqual(calls.metadata[0], {
    imageId: "image-1",
    subject: "patient monitor",
    attributes: ["bedside", "vital signs", "display"],
    caption: "A patient monitor displaying vital signs.",
    confidence: 0.92
  });

  assert.deepEqual(calls.embeddings[0], {
    imageId: "image-1",
    model: "mock-embedding",
    modelVersion: "v1",
    embedding: [0.12, 0.34, 0.56, 0.78]
  });

  assert.equal(result.lowConfidence, false);
  assert.equal(calls.costs.length, 1);
  assert.equal(calls.costs[0].operation, "image_processing");
  assert.equal(calls.costs[0].success, true);
});

test("image processing flags metadata below the confidence threshold", async () => {
  const { dependencies } = createDependencies({
    visionProvider: {
      async analyzeImage() {
        return {
          subject: "patient monitor",
          category: "medical_equipment",
          attributes: ["display"],
          caption: "A patient monitor displaying vital signs.",
          confidence: 0.69
        };
      }
    }
  });

  const service = new ImageProcessingService(dependencies);

  const result = await service.processImage("image-1");

  assert.equal(result.lowConfidence, true);
});

test("image processing rejects invalid vision metadata", async () => {
  const { dependencies, calls } = createDependencies({
    visionProvider: {
      async analyzeImage() {
        return {
          subject: "patient monitor",
          category: "medical_equipment",
          attributes: "not-an-array",
          caption: "A patient monitor displaying vital signs.",
          confidence: 0.92
        };
      }
    }
  });

  const service = new ImageProcessingService(dependencies);

  await assert.rejects(
    () => service.processImage("image-1"),
    /Invalid input/
  );

  assert.deepEqual(
    calls.statuses.map((call) => call.status),
    ["processing", "failed"]
  );

  assert.equal(calls.costs.length, 1);
  assert.equal(calls.costs[0].success, false);
});

test("image processing fails the image when embedding fails", async () => {
  const { dependencies, calls } = createDependencies({
    embeddingProvider: {
      async embedText() {
        throw new Error("embedding provider unavailable");
      }
    }
  });

  const service = new ImageProcessingService(dependencies);

  await assert.rejects(
    () => service.processImage("image-1"),
    /embedding provider unavailable/
  );

  assert.deepEqual(
    calls.statuses.map((call) => call.status),
    ["processing", "failed"]
  );

  assert.equal(calls.costs[0].success, false);
  assert.equal(
    calls.costs[0].errorMessage,
    "embedding provider unavailable"
  );
});

test("image processing rejects a missing image", async () => {
  const { dependencies, calls } = createDependencies({
    imageRepository: {
      async findImageById() {
        return null;
      },

      async updateImageStatus() {
        throw new Error("should not be called");
      }
    }
  });

  const service = new ImageProcessingService(dependencies);

  await assert.rejects(
    () => service.processImage("missing-image"),
    /Image not found: missing-image/
  );

  assert.equal(calls.statuses.length, 0);
  assert.equal(calls.costs.length, 0);
});
