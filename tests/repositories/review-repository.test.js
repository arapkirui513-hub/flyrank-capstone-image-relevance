import assert from "node:assert/strict";
import test, { after } from "node:test";

import { pool } from "../../app/db/pool.js";
import {
  createReview,
  findReviewById,
  findReviewsBySuggestionId,
  deleteReview
} from "../../app/repositories/review-repository.js";
import { createImage } from "../../app/repositories/image-repository.js";
import { createPost } from "../../app/repositories/post-repository.js";
import { createSuggestion } from "../../app/repositories/suggestion-repository.js";

test("review repository persists, retrieves, lists, and deletes reviews", async () => {
  const image = await createImage({
    filename: `review-test-${Date.now()}.jpg`,
    category: "medical_equipment"
  });

  const post = await createPost({
    title: `Review test ${Date.now()}`,
    content: "A hospital patient monitor displays vital signs."
  });

  const suggestion = await createSuggestion({
    postId: post.id,
    imageId: image.id,
    similarityScore: 0.87321,
    guardDecision: "accepted",
    guardVersion: "v1"
  });

  const created = await createReview({
    suggestionId: suggestion.id,
    decision: "approved",
    reason: "Image and post are relevant."
  });

  assert.ok(created.id);
  assert.equal(created.suggestion_id, suggestion.id);
  assert.equal(created.decision, "approved");
  assert.equal(created.reason, "Image and post are relevant.");
  assert.ok(created.reviewed_at);

  const found = await findReviewById(created.id);

  assert.ok(found);
  assert.equal(found.id, created.id);
  assert.equal(found.suggestion_id, suggestion.id);
  assert.equal(found.decision, "approved");

  const reviews = await findReviewsBySuggestionId(
    suggestion.id
  );

  assert.ok(
    reviews.some((review) => review.id === created.id)
  );

  const deleted = await deleteReview(created.id);

  assert.ok(deleted);
  assert.equal(deleted.id, created.id);

  const afterDelete = await findReviewById(created.id);

  assert.equal(afterDelete, null);

  await pool.query(
    "DELETE FROM suggestions WHERE id = $1",
    [suggestion.id]
  );

  await pool.query(
    "DELETE FROM posts WHERE id = $1",
    [post.id]
  );

  await pool.query(
    "DELETE FROM images WHERE id = $1",
    [image.id]
  );
});

test("review repository supports rejected reviews with a reason", async () => {
  const image = await createImage({
    filename: `rejected-review-test-${Date.now()}.jpg`,
    category: "medical_equipment"
  });

  const post = await createPost({
    title: `Rejected review test ${Date.now()}`,
    content: "An unrelated article."
  });

  const suggestion = await createSuggestion({
    postId: post.id,
    imageId: image.id,
    similarityScore: 0.21456,
    guardDecision: "rejected",
    rejectionReason: "Similarity score below acceptance threshold",
    guardVersion: "v1"
  });

  const review = await createReview({
    suggestionId: suggestion.id,
    decision: "rejected",
    reason: "The image does not match the article."
  });

  assert.equal(review.decision, "rejected");
  assert.equal(
    review.reason,
    "The image does not match the article."
  );

  await deleteReview(review.id);

  await pool.query(
    "DELETE FROM suggestions WHERE id = $1",
    [suggestion.id]
  );

  await pool.query(
    "DELETE FROM posts WHERE id = $1",
    [post.id]
  );

  await pool.query(
    "DELETE FROM images WHERE id = $1",
    [image.id]
  );
});

test("deleting a suggestion cascades to its reviews", async () => {
  const image = await createImage({
    filename: `review-cascade-test-${Date.now()}.jpg`,
    category: "medical_equipment"
  });

  const post = await createPost({
    title: `Review cascade test ${Date.now()}`,
    content: "A medical equipment article."
  });

  const suggestion = await createSuggestion({
    postId: post.id,
    imageId: image.id,
    similarityScore: 0.91234,
    guardDecision: "accepted",
    guardVersion: "v1"
  });

  const review = await createReview({
    suggestionId: suggestion.id,
    decision: "approved",
    reason: "Verified by reviewer."
  });

  await pool.query(
    "DELETE FROM suggestions WHERE id = $1",
    [suggestion.id]
  );

  const deletedReview = await findReviewById(review.id);

  assert.equal(deletedReview, null);

  await pool.query(
    "DELETE FROM posts WHERE id = $1",
    [post.id]
  );

  await pool.query(
    "DELETE FROM images WHERE id = $1",
    [image.id]
  );
});

after(async () => {
  await pool.end();
});