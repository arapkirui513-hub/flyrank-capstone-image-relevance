import assert from "node:assert/strict";
import test, { after } from "node:test";

import { pool } from "../../app/db/pool.js";
import {
  createImageMetadata,
  findImageMetadataByImageId,
  updateImageMetadata
} from "../../app/repositories/image-metadata-repository.js";
import { createImage } from "../../app/repositories/image-repository.js";

test("image metadata persists, retrieves, updates, and cascades on image deletion", async () => {
  const image = await createImage({
    filename: `metadata-test-${Date.now()}.jpg`,
    category: "medical_equipment"
  });

  try {
    const created = await createImageMetadata({
      imageId: image.id,
      subject: "defibrillator",
      category: "medical_equipment",
      attributes: [
        "portable",
        "control buttons",
        "electrode cables"
      ],
      caption: "A modern medical defibrillator",
      confidence: 0.94
    });

    assert.equal(created.image_id, image.id);
    assert.equal(created.subject, "defibrillator");
    assert.equal(created.category, "medical_equipment");
    assert.deepEqual(created.attributes, [
      "portable",
      "control buttons",
      "electrode cables"
    ]);
    assert.equal(created.caption, "A modern medical defibrillator");
    assert.equal(Number(created.confidence), 0.94);

    const found = await findImageMetadataByImageId(image.id);

    assert.ok(found);
    assert.equal(found.image_id, image.id);
    assert.equal(found.subject, "defibrillator");
    assert.equal(found.category, "medical_equipment");
    assert.deepEqual(found.attributes, [
      "portable",
      "control buttons",
      "electrode cables"
    ]);

    const updated = await updateImageMetadata(image.id, {
      subject: "automated_external_defibrillator",
      category: "automated_defibrillator",
      attributes: [
        "portable",
        "display",
        "electrode pads"
      ],
      caption: "A portable automated external defibrillator",
      confidence: 0.97
    });

    assert.ok(updated);
    assert.equal(
      updated.subject,
      "automated_external_defibrillator"
    );
    assert.equal(
      updated.category,
      "automated_defibrillator"
    );
    assert.deepEqual(updated.attributes, [
      "portable",
      "display",
      "electrode pads"
    ]);
    assert.equal(
      updated.caption,
      "A portable automated external defibrillator"
    );
    assert.equal(Number(updated.confidence), 0.97);

    await pool.query(
      "DELETE FROM images WHERE id = $1",
      [image.id]
    );

    const deletedMetadata =
      await findImageMetadataByImageId(image.id);

    assert.equal(deletedMetadata, null);
  } finally {
    await pool.query(
      "DELETE FROM image_metadata WHERE image_id = $1",
      [image.id]
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