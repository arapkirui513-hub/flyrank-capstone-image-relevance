import assert from "node:assert/strict";
import test, { after } from "node:test";

import { pool } from "../../app/db/pool.js";
import {
  createPostEmbedding,
  findPostEmbedding,
  findPostEmbeddingsByPostId,
  deletePostEmbedding
} from "../../app/repositories/post-embedding-repository.js";
import { createPost } from "../../app/repositories/post-repository.js";

test("post embedding repository persists, retrieves, lists, and deletes embeddings", async () => {
  const post = await createPost({
    title: `Embedding test ${Date.now()}`,
    content: "A hospital patient monitor is used to display vital signs."
  });

  const model = "test-embedding-model";
  const modelVersion = "v1";

  const embedding = [0.12, 0.34, 0.56, 0.78];

  const created = await createPostEmbedding({
    postId: post.id,
    model,
    modelVersion,
    embedding
  });

  assert.ok(created.id);
  assert.equal(created.post_id, post.id);
  assert.equal(created.model, model);
  assert.equal(created.model_version, modelVersion);
  assert.deepEqual(created.embedding, embedding);

  const found = await findPostEmbedding({
    postId: post.id,
    model,
    modelVersion
  });

  assert.ok(found);
  assert.equal(found.id, created.id);
  assert.deepEqual(found.embedding, embedding);

  const allEmbeddings =
    await findPostEmbeddingsByPostId(post.id);

  assert.ok(
    allEmbeddings.some(
      (item) => item.id === created.id
    )
  );

  const deleted = await deletePostEmbedding({
    postId: post.id,
    model,
    modelVersion
  });

  assert.ok(deleted);
  assert.equal(deleted.id, created.id);

  const afterDelete = await findPostEmbedding({
    postId: post.id,
    model,
    modelVersion
  });

  assert.equal(afterDelete, null);

  await pool.query(
    "DELETE FROM posts WHERE id = $1",
    [post.id]
  );
});

after(async () => {
  await pool.end();
});