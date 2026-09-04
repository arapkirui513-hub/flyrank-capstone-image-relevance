import assert from "node:assert/strict";
import test, { after } from "node:test";

import { pool } from "../../app/db/pool.js";
import {
  createImage,
  findImageById,
  findImages,
  updateImageStatus
} from "../../app/repositories/image-repository.js";

test("image repository persists and retrieves images", async () => {
  const filename = `test-image-${Date.now()}.jpg`;
  const category = "medical_equipment";

  const created = await createImage({
    filename,
    category
  });

  assert.ok(created.id);
  assert.equal(created.filename, filename);
  assert.equal(created.category, category);
  assert.equal(created.status, "pending");

  const found = await findImageById(created.id);

  assert.ok(found);
  assert.equal(found.id, created.id);
  assert.equal(found.filename, filename);

  const updated = await updateImageStatus(
    created.id,
    "processing"
  );

  assert.ok(updated);
  assert.equal(updated.id, created.id);
  assert.equal(updated.status, "processing");

  const filtered = await findImages({
    category,
    status: "processing"
  });

  assert.ok(
    filtered.some((image) => image.id === created.id)
  );

  await pool.query(
    "DELETE FROM images WHERE id = $1",
    [created.id]
  );
});

after(async () => {
  await pool.end();
});