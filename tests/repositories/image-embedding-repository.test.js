import assert from "node:assert/strict";
import test, { after } from "node:test";

import { pool } from "../../app/db/pool.js";
import {
  createImageEmbedding,
  findImageEmbedding,
  findImageEmbeddingsByImageId,
  findImageEmbeddingsWithMetadata,
  deleteImageEmbedding
} from "../../app/repositories/image-embedding-repository.js";
import { createImage } from "../../app/repositories/image-repository.js";
import { createImageMetadata } from "../../app/repositories/image-metadata-repository.js";

test("image embedding repository persists, retrieves, lists, and deletes embeddings", async () => {
  const image = await createImage({
    filename: `embedding-test-${Date.now()}.jpg`,
    category: "medical_equipment"
  });

  const model = "test-embedding-model";
  const modelVersion = "v1";
  const embedding = [0.12, 0.34, 0.56, 0.78];

  const created = await createImageEmbedding({
    imageId: image.id,
    model,
    modelVersion,
    embedding
  });

  assert.ok(created.id);
  assert.equal(created.image_id, image.id);
  assert.equal(created.model, model);
  assert.equal(created.model_version, modelVersion);
  assert.deepEqual(created.embedding, embedding);

  const found = await findImageEmbedding({
    imageId: image.id,
    model,
    modelVersion
  });

  assert.ok(found);
  assert.equal(found.id, created.id);
  assert.deepEqual(found.embedding, embedding);

  const allEmbeddings =
    await findImageEmbeddingsByImageId(image.id);

  assert.ok(
    allEmbeddings.some(
      (item) => item.id === created.id
    )
  );

  const deleted = await deleteImageEmbedding({
    imageId: image.id,
    model,
    modelVersion
  });

  assert.ok(deleted);
  assert.equal(deleted.id, created.id);

  const afterDelete = await findImageEmbedding({
    imageId: image.id,
    model,
    modelVersion
  });

  assert.equal(afterDelete, null);

  await pool.query(
    "DELETE FROM images WHERE id = $1",
    [image.id]
  );
});

test("findImageEmbeddingsWithMetadata joins embedding with image and metadata", async () => {
  const image = await createImage({
    filename: `join-test-${Date.now()}.jpg`,
    category: "medical_equipment"
  });

  await createImageMetadata({
    imageId: image.id,
    subject: "patient monitor",
    attributes: [],
    caption: "A patient monitor",
    confidence: 0.92
  });

  await createImageEmbedding({
    imageId: image.id,
    model: "test-embedding",
    modelVersion: "v1",
    embedding: [0.1, 0.2]
  });

  const rows = await findImageEmbeddingsWithMetadata({
    model: "test-embedding",
    modelVersion: "v1"
  });

  const row = rows.find(
    (item) => item.image_id === image.id
  );

  assert.ok(row);
  assert.equal(row.category, "medical_equipment");
  assert.equal(row.subject, "patient monitor");
  assert.equal(Number(row.confidence), 0.92);
  assert.deepEqual(row.embedding, [0.1, 0.2]);

  await pool.query(
    "DELETE FROM images WHERE id = $1",
    [image.id]
  );
});

after(async () => {
  await pool.end();
});
