import assert from "node:assert/strict";
import test, { after } from "node:test";

import { pool } from "../../app/db/pool.js";
import {
  createPost,
  findPostById,
  findPosts,
  updatePost,
  deletePost
} from "../../app/repositories/post-repository.js";

test("post repository persists, retrieves, updates, lists, and deletes posts", async () => {
  const title = `Test post ${Date.now()}`;
  const content = "Initial test post content.";

  const created = await createPost({
    title,
    content
  });

  assert.ok(created.id);
  assert.equal(created.title, title);
  assert.equal(created.content, content);
  assert.ok(created.created_at);
  assert.ok(created.updated_at);

  const found = await findPostById(created.id);

  assert.ok(found);
  assert.equal(found.id, created.id);
  assert.equal(found.title, title);
  assert.equal(found.content, content);

  const updated = await updatePost(created.id, {
    title: "Updated test post",
    content: "Updated test post content."
  });

  assert.ok(updated);
  assert.equal(updated.id, created.id);
  assert.equal(updated.title, "Updated test post");
  assert.equal(updated.content, "Updated test post content.");

  const posts = await findPosts({
    limit: 50,
    offset: 0
  });

  assert.ok(
    posts.some((post) => post.id === created.id)
  );

  const deleted = await deletePost(created.id);

  assert.ok(deleted);
  assert.equal(deleted.id, created.id);

  const afterDelete = await findPostById(created.id);

  assert.equal(afterDelete, null);
});

after(async () => {
  await pool.end();
});