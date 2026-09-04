import assert from "node:assert/strict";
import test from "node:test";

import { PostEmbeddingService } from "../../app/services/post-embedding-service.js";

function createDependencies(overrides = {}) {
  const calls = {
    embeddings: []
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

    embeddingProvider: {
      async embedText(text) {
        assert.equal(
          text,
          "Routine maintenance guidance for patient monitoring equipment."
        );

        return [0.12, 0.34, 0.56, 0.78];
      }
    },

    embeddingModel: "mock-embedding",
    embeddingModelVersion: "v1",

    ...overrides
  };

  return {
    dependencies,
    calls
  };
}

test("post embedding generates and persists an embedding", async () => {
  const { dependencies, calls } = createDependencies();

  const service = new PostEmbeddingService(dependencies);

  const result = await service.embedPost("post-1");

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
});

test("post embedding rejects a missing post", async () => {
  const { dependencies, calls } = createDependencies({
    postRepository: {
      async findPostById() {
        return null;
      }
    }
  });

  const service = new PostEmbeddingService(dependencies);

  await assert.rejects(
    () => service.embedPost("missing-post"),
    /Post not found: missing-post/
  );

  assert.equal(calls.embeddings.length, 0);
});

test("post embedding fails when the provider returns an invalid embedding", async () => {
  const { dependencies, calls } = createDependencies({
    embeddingProvider: {
      async embedText() {
        return [];
      }
    }
  });

  const service = new PostEmbeddingService(dependencies);

  await assert.rejects(
    () => service.embedPost("post-1"),
    /Embedding provider returned an invalid embedding/
  );

  assert.equal(calls.embeddings.length, 0);
});

test("post embedding propagates provider errors", async () => {
  const { dependencies, calls } = createDependencies({
    embeddingProvider: {
      async embedText() {
        throw new Error("embedding provider unavailable");
      }
    }
  });

  const service = new PostEmbeddingService(dependencies);

  await assert.rejects(
    () => service.embedPost("post-1"),
    /embedding provider unavailable/
  );

  assert.equal(calls.embeddings.length, 0);
});