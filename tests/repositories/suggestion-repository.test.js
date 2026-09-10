import assert from "node:assert/strict";
import test, { after } from "node:test";

import { pool } from "../../app/db/pool.js";
import {
  createSuggestion,
  findSuggestionById,
  findSuggestions,
  findImagesByPostId,
  deleteSuggestion
} from "../../app/repositories/suggestion-repository.js";
import { createImage } from "../../app/repositories/image-repository.js";
import { createPost } from "../../app/repositories/post-repository.js";

test("suggestion repository persists, retrieves, filters, and deletes suggestions", async () => {
  const image = await createImage({
    filename: `suggestion-test-${Date.now()}.jpg`,
    category: "medical_equipment"
  });

  const post = await createPost({
    title: `Suggestion test ${Date.now()}`,
    content: "A hospital patient monitor displays vital signs."
  });

  let created;

  try {
    created = await createSuggestion({
      postId: post.id,
      imageId: image.id,
      similarityScore: 0.87321,
      guardDecision: "accepted",
      guardVersion: "v1"
    });

    assert.ok(created.id);
    assert.equal(created.post_id, post.id);
    assert.equal(created.image_id, image.id);
    assert.equal(Number(created.similarity_score), 0.87321);
    assert.equal(created.guard_decision, "accepted");
    assert.equal(created.rejection_reason, null);
    assert.equal(created.guard_version, "v1");

    const found = await findSuggestionById(created.id);

    assert.ok(found);
    assert.equal(found.id, created.id);
    assert.equal(found.post_id, post.id);
    assert.equal(found.image_id, image.id);

    const filtered = await findSuggestions({
      postId: post.id,
      imageId: image.id,
      guardDecision: "accepted"
    });

    const postImages = await findImagesByPostId(post.id);

assert.ok(
  postImages.some((result) => result.suggestion_id === created.id)
);

assert.equal(
  postImages.find((result) => result.suggestion_id === created.id)?.id,
  image.id
);

    assert.ok(
      filtered.some((suggestion) => suggestion.id === created.id)
    );

    const deleted = await deleteSuggestion(created.id);

    assert.ok(deleted);
    assert.equal(deleted.id, created.id);

    const afterDelete = await findSuggestionById(created.id);

    assert.equal(afterDelete, null);
  } finally {
    if (created?.id) {
      await pool.query(
        "DELETE FROM suggestions WHERE id = $1",
        [created.id]
      );
    }

    await pool.query(
      "DELETE FROM posts WHERE id = $1",
      [post.id]
    );

    await pool.query(
      "DELETE FROM images WHERE id = $1",
      [image.id]
    );
  }
});

test("suggestion repository preserves rejection reason for rejected suggestions", async () => {
  const image = await createImage({
    filename: `rejected-suggestion-test-${Date.now()}.jpg`,
    category: "medical_equipment"
  });

  const post = await createPost({
    title: `Rejected suggestion test ${Date.now()}`,
    content: "An unrelated article."
  });

  let created;

  try {
    created = await createSuggestion({
      postId: post.id,
      imageId: image.id,
      similarityScore: 0.21456,
      guardDecision: "rejected",
      rejectionReason: "Similarity score below acceptance threshold",
      guardVersion: "v1"
    });

    assert.equal(created.guard_decision, "rejected");
    assert.equal(
      created.rejection_reason,
      "Similarity score below acceptance threshold"
    );

    await deleteSuggestion(created.id);
  } finally {
    if (created?.id) {
      await pool.query(
        "DELETE FROM suggestions WHERE id = $1",
        [created.id]
      );
    }

    await pool.query(
      "DELETE FROM posts WHERE id = $1",
      [post.id]
    );

    await pool.query(
      "DELETE FROM images WHERE id = $1",
      [image.id]
    );
  }
});

after(async () => {
  await pool.end();
});