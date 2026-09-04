import { pool } from "../db/pool.js";

export async function createImageMetadata({
  imageId,
  subject,
  attributes = [],
  caption,
  confidence
}) {
  const result = await pool.query(
    `
      INSERT INTO image_metadata (
        image_id,
        subject,
        attributes,
        caption,
        confidence
      )
      VALUES ($1, $2, $3::jsonb, $4, $5)
      RETURNING
        image_id,
        subject,
        attributes,
        caption,
        confidence
    `,
    [
      imageId,
      subject,
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
        attributes = $3::jsonb,
        caption = $4,
        confidence = $5
      WHERE image_id = $1
      RETURNING
        image_id,
        subject,
        attributes,
        caption,
        confidence
    `,
    [
      imageId,
      subject,
      JSON.stringify(attributes),
      caption,
      confidence
    ]
  );

  return result.rows[0] ?? null;
}