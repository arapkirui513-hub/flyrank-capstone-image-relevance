import { pool } from "../db/pool.js";

export async function createImageMetadata({
  imageId,
  subject,
  category,
  attributes = [],
  caption,
  confidence
}) {
  const result = await pool.query(
    `
      INSERT INTO image_metadata (
        image_id,
        subject,
        category,
        attributes,
        caption,
        confidence
      )
      VALUES ($1, $2, $3, $4::jsonb, $5, $6)
      ON CONFLICT (image_id)
      DO UPDATE SET
        subject = EXCLUDED.subject,
        category = EXCLUDED.category,
        attributes = EXCLUDED.attributes,
        caption = EXCLUDED.caption,
        confidence = EXCLUDED.confidence
      RETURNING
        image_id,
        subject,
        category,
        attributes,
        caption,
        confidence
    `,
    [
      imageId,
      subject,
      category,
      JSON.stringify(attributes),
      caption,
      confidence
    ]
  );

  return result.rows[0];
}

export async function findImageMetadataByImageId(imageId) {
  const result = await pool.query(
    `
      SELECT
        image_id,
        subject,
        category,
        attributes,
        caption,
        confidence
      FROM image_metadata
      WHERE image_id = $1
    `,
    [imageId]
  );

  return result.rows[0] ?? null;
}

export async function updateImageMetadata(
  imageId,
  {
    subject,
    category,
    attributes = [],
    caption,
    confidence
  }
) {
  const result = await pool.query(
    `
      UPDATE image_metadata
      SET
        subject = $2,
        category = $3,
        attributes = $4::jsonb,
        caption = $5,
        confidence = $6
      WHERE image_id = $1
      RETURNING
        image_id,
        subject,
        category,
        attributes,
        caption,
        confidence
    `,
    [
      imageId,
      subject,
      category,
      JSON.stringify(attributes),
      caption,
      confidence
    ]
  );

  return result.rows[0] ?? null;
}
