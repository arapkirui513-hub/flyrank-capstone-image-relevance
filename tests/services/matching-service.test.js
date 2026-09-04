import assert from "node:assert/strict";
import test from "node:test";

import { MatchingService } from "../../app/services/matching-service.js";

function createDependencies(overrides = {}) {
  const postEmbedding = {
    id: "post-embedding-1",
    post_id: "post-1",
    model: "mock-embedding",
    model_version: "v1",
    embedding: [1, 0, 0]
  };

  const imageEmbeddings = [
    {
      id: "image-embedding-1",
      image_id: "image-a",
      model: "mock-embedding",
      model_version: "v1",
      embedding: [1, 0, 0]
    },
    {
      id: "image-embedding-2",
      image_id: "image-b",
      model: "mock-embedding",
      model_version: "v1",
      embedding: [0, 1, 0]
    },
    {
      id: "image-embedding-3",
      image_id: "image-c",
      model: "mock-embedding",
      model_version: "v1",
      embedding: [-1, 0, 0]
    }
  ];

  return {
    postEmbeddingRepository: {
      async findPostEmbedding() {
        return postEmbedding;
      }
    },

    imageEmbeddingRepository: {
      async findImageEmbeddingsByImageId() {
        return [];
      },

      async findAllImageEmbeddings() {
        return imageEmbeddings;
      }
    },

    ...overrides
  };
}

test("matching service ranks image candidates by cosine similarity", async () => {
  const dependencies = createDependencies();

  const service = new MatchingService(dependencies);

  const results = await service.matchPost("post-1");

  assert.equal(results.length, 3);

  assert.equal(results[0].imageId, "image-a");
  assert.equal(results[1].imageId, "image-b");
  assert.equal(results[2].imageId, "image-c");

  assert.equal(results[0].similarityScore, 1);
  assert.equal(results[1].similarityScore, 0);
  assert.equal(results[2].similarityScore, -1);
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
      async findAllImageEmbeddings() {
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
      async findAllImageEmbeddings() {
        return [
          {
            id: "image-embedding-1",
            image_id: "image-a",
            model: "mock-embedding",
            model_version: "v1",
            embedding: [1, 0]
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
          id: "post-embedding-1",
          post_id: "post-1",
          model: "mock-embedding",
          model_version: "v1",
          embedding: [0, 0, 0]
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
    limit: 2
  });

  assert.equal(results.length, 2);
  assert.equal(results[0].imageId, "image-a");
  assert.equal(results[1].imageId, "image-b");
});
