import assert from "node:assert/strict";
import test from "node:test";

import { PostEmbeddingService } from "../../app/services/post-embedding-service.js";

function createDependencies(overrides = {}) {
  const calls = {
    embeddings: [],
    costLogs: []
  };

  const dependencies = {
    postRepository: {
      async findPostById(id) {
        return {
          id,
          title: "Patient Monitor Maintenance",
          content:
            "Routine maintenance guidance for patient monitoring equipment."
        };
      }
    },

    postEmbeddingRepository: {
      async createPostEmbedding(embedding) {
        calls.embeddings.push(embedding);

        return {
          id: "post-embedding-1",
          ...embedding
        };
      }
    },

    aiCostLogRepository: {
      async createAiCostLog(log) {
        calls.costLogs.push(log);

        return {
          id: "cost-log-1",
          ...log
        };
      }
    },

    embeddingProvider: {
      async embedText(text) {
        assert.equal(
          text,
          "Routine maintenance guidance for patient monitoring equipment."
        );

        return {
          data: [0.12, 0.34, 0.56, 0.78],
          usage: {
            inputTokens: 25,
            outputTokens: null
          }
        };
      }
    },

    embeddingModel: "mock-embedding",
    embeddingModelVersion: "v1",
    embeddingProviderName: "gemini",
    embeddingInputCostPerMillion: 0.15,
    embeddingOutputCostPerMillion: 0,

    now: (() => {
      const times = [
        new Date("2026-09-10T10:00:00.000Z"),
        new Date("2026-09-10T10:00:00.125Z")
      ];

      return () => times.shift() || times[times.length - 1];
    })(),

    ...overrides
  };

  return {
    dependencies,
    calls
  };
}

test("post embedding generates, persists, and logs an embedding call", async () => {
  const { dependencies, calls } =
    createDependencies();

  const service =
    new PostEmbeddingService(dependencies);

  const result =
    await service.embedPost("post-1");

  assert.deepEqual(calls.embeddings[0], {
    postId: "post-1",
    model: "mock-embedding",
    modelVersion: "v1",
    embedding: [0.12, 0.34, 0.56, 0.78]
  });

  assert.deepEqual(result, {
    id: "post-embedding-1",
    postId: "post-1",
    model: "mock-embedding",
    modelVersion: "v1",
    embedding: [0.12, 0.34, 0.56, 0.78]
  });

  assert.equal(calls.costLogs.length, 1);
  assert.equal(calls.costLogs[0].jobId, null);
  assert.equal(calls.costLogs[0].operation, "embedding_generation");
  assert.equal(calls.costLogs[0].provider, "gemini");
  assert.equal(calls.costLogs[0].model, "mock-embedding");
  assert.equal(calls.costLogs[0].inputTokens, 25);
  assert.equal(calls.costLogs[0].outputTokens, null);
  assert.equal(calls.costLogs[0].durationMs, 125);
  assert.equal(calls.costLogs[0].estimatedCostUsd, 0.00000375);
  assert.equal(calls.costLogs[0].success, true);
  assert.equal(calls.costLogs[0].errorMessage, null);
});

test("post embedding rejects a missing post", async () => {
  const { dependencies, calls } =
    createDependencies({
      postRepository: {
        async findPostById() {
          return null;
        }
      }
    });

  const service =
    new PostEmbeddingService(dependencies);

  await assert.rejects(
    () => service.embedPost("missing-post"),
    /Post not found: missing-post/
  );

  assert.equal(calls.embeddings.length, 0);
  assert.equal(calls.costLogs.length, 0);
});

test("post embedding fails when the provider returns an invalid embedding", async () => {
  const { dependencies, calls } =
    createDependencies({
      embeddingProvider: {
        async embedText() {
          return {
            data: [],
            usage: {
              inputTokens: 25,
              outputTokens: null
            }
          };
        }
      }
    });

  const service =
    new PostEmbeddingService(dependencies);

  await assert.rejects(
    () => service.embedPost("post-1"),
    /Embedding provider returned an invalid embedding/
  );

  assert.equal(calls.embeddings.length, 0);
  assert.equal(calls.costLogs.length, 1);
  assert.equal(calls.costLogs[0].success, true);
});

test("post embedding fails when provider data is missing", async () => {
  const { dependencies, calls } =
    createDependencies({
      embeddingProvider: {
        async embedText() {
          return {
            usage: {
              inputTokens: 25,
              outputTokens: null
            }
          };
        }
      }
    });

  const service =
    new PostEmbeddingService(dependencies);

  await assert.rejects(
    () => service.embedPost("post-1"),
    /Embedding provider returned an invalid embedding/
  );

  assert.equal(calls.embeddings.length, 0);
  assert.equal(calls.costLogs.length, 1);
  assert.equal(calls.costLogs[0].success, true);
});

test("post embedding records a failed AI call", async () => {
  const { dependencies, calls } =
    createDependencies({
      embeddingProvider: {
        async embedText() {
          throw new Error(
            "embedding provider unavailable"
          );
        }
      }
    });

  const service =
    new PostEmbeddingService(dependencies);

  await assert.rejects(
    () => service.embedPost("post-1"),
    /embedding provider unavailable/
  );

  assert.equal(calls.embeddings.length, 0);
  assert.equal(calls.costLogs.length, 1);
  assert.equal(calls.costLogs[0].jobId, null);
  assert.equal(calls.costLogs[0].operation, "embedding_generation");
  assert.equal(calls.costLogs[0].provider, "gemini");
  assert.equal(calls.costLogs[0].model, "mock-embedding");
  assert.equal(calls.costLogs[0].inputTokens, null);
  assert.equal(calls.costLogs[0].outputTokens, null);
  assert.equal(calls.costLogs[0].estimatedCostUsd, null);
  assert.equal(calls.costLogs[0].success, false);
  assert.equal(
    calls.costLogs[0].errorMessage,
    "embedding provider unavailable"
  );
});
