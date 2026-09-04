import assert from "node:assert/strict";
import test from "node:test";

import { cosineSimilarity } from "../../app/domain/similarity.js";

test("cosine similarity returns 1 for identical vectors", () => {
  assert.equal(
    cosineSimilarity([1, 2, 3], [1, 2, 3]),
    1
  );
});

test("cosine similarity returns 0 for orthogonal vectors", () => {
  assert.equal(
    cosineSimilarity([1, 0], [0, 1]),
    0
  );
});

test("cosine similarity handles opposite vectors", () => {
  assert.equal(
    cosineSimilarity([1, 0], [-1, 0]),
    -1
  );
});

test("cosine similarity calculates non-trivial vectors", () => {
  const result = cosineSimilarity(
    [0.12, 0.34, 0.56, 0.78],
    [0.24, 0.68, 0.56, 0.39]
  );

  assert.ok(result > 0);
  assert.ok(result < 1);
});

test("cosine similarity rejects vectors with different lengths", () => {
  assert.throws(
    () => cosineSimilarity([1, 2], [1, 2, 3]),
    /same length/
  );
});

test("cosine similarity rejects empty vectors", () => {
  assert.throws(
    () => cosineSimilarity([], []),
    /non-empty/
  );
});

test("cosine similarity rejects non-array inputs", () => {
  assert.throws(
    () => cosineSimilarity("embedding", [1, 2]),
    /requires two arrays/
  );
});

test("cosine similarity rejects zero vectors", () => {
  assert.throws(
    () => cosineSimilarity([0, 0], [1, 2]),
    /zero vector/
  );
});