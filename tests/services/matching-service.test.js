import assert from "node:assert/strict";
import test from "node:test";

import { MatchingService } from "../../app/services/matching-service.js";

const imageEmbeddings = [
  {
    image_id: "img-1",
    subject: "patient monitor",
    category: "medical_equipment",
    confidence: 0.95,
    embedding: [1, 0]
  },
  {
    image_id: "img-2",
    subject: "defibrillator",
    category: "medical_equipment",
    confidence: 0.90,
    embedding: [0, 1]
  }
];

function createDependencies(overrides = {}) {
  return {
    postEmbeddingRepository: {
      async findPostEmbedding({ postId }) {
        if (postId === "post-1") {
          return {
            embedding: [1, 0]
          };
        }

        return null;
      }
    },

    imageEmbeddingRepository: {
      async findImageEmbeddingsWithMetadata() {
        return imageEmbeddings;
      }
    },

    model: "mock-embedding",
    modelVersion: "v1",

    ...overrides
  };
}

test("matching service ranks image candidates by cosine similarity", async () => {
  const dependencies = createDependencies();

  const service = new MatchingService(dependencies);

  const results = await service.matchPost("post-1");

  assert.equal(results.length, 2);

  assert.equal(results[0].imageId, "img-1");
  assert.equal(results[1].imageId, "img-2");

  assert.equal(results[0].similarity, 1);
  assert.equal(results[1].similarity, 0);
});

test("matching service returns an empty list when the post has no embedding", async () => {
  const dependencies = createDependencies({
    postEmbeddingRepository: {
      async findPostEmbedding() {
        return null;
      }
    }
  });

  const service = new MatchingService(dependencies);

  const results = await service.matchPost("post-1");

  assert.deepEqual(results, []);
});

test("matching service returns an empty list when there are no image embeddings", async () => {
  const dependencies = createDependencies({
    imageEmbeddingRepository: {
      async findImageEmbeddingsWithMetadata() {
        return [];
      }
    }
  });

  const service = new MatchingService(dependencies);

  const results = await service.matchPost("post-1");

  assert.deepEqual(results, []);
});

test("matching service rejects embeddings with different dimensions", async () => {
  const dependencies = createDependencies({
    imageEmbeddingRepository: {
      async findImageEmbeddingsWithMetadata() {
        return [
          {
            image_id: "img-1",
            subject: "patient monitor",
            category: "medical_equipment",
            confidence: 0.95,
            embedding: [1, 0, 0]
          }
        ];
      }
    }
  });

  const service = new MatchingService(dependencies);

  await assert.rejects(
    () => service.matchPost("post-1"),
    /same length|dimension/i
  );
});

test("matching service rejects zero-magnitude vectors", async () => {
  const dependencies = createDependencies({
    postEmbeddingRepository: {
      async findPostEmbedding() {
        return {
          embedding: [0, 0]
        };
      }
    }
  });

  const service = new MatchingService(dependencies);

  await assert.rejects(
    () => service.matchPost("post-1"),
    /zero vector|magnitude/i
  );
});

test("matching service supports limiting ranked results", async () => {
  const dependencies = createDependencies();

  const service = new MatchingService(dependencies);

  const results = await service.matchPost("post-1", {
    limit: 1
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].imageId, "img-1");
});

test("matching service returns metadata required for guard evaluation", async () => {
  const dependencies = createDependencies();

  const service = new MatchingService(dependencies);

  const results = await service.matchPost("post-1");

  assert.equal(results.length, 2);

  assert.equal(results[0].imageId, "img-1");
  assert.equal(results[0].subject, "patient monitor");
  assert.equal(results[0].category, "medical_equipment");
  assert.equal(results[0].confidence, 0.95);
  assert.equal(results[0].similarity, 1);

  assert.equal(results[1].imageId, "img-2");
  assert.equal(results[1].subject, "defibrillator");
  assert.equal(results[1].category, "medical_equipment");
  assert.equal(results[1].confidence, 0.90);
  assert.equal(results[1].similarity, 0);
});