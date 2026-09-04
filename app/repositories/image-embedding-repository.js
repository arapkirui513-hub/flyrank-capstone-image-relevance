import { pool } from "../db/pool.js";

export async function createImageEmbedding({
  imageId,
  model,
  modelVersion,
  embedding
}) {
  const result = await pool.query(
    `
      INSERT INTO image_embeddings (
        image_id,
        model,
        model_version,
        embedding
      )
      VALUES ($1, $2, $3, $4::jsonb)
      RETURNING
        id,
        image_id,
        model,
        model_version,
        embedding,
        created_at
    `,
    [
      imageId,
      model,
      modelVersion,
      JSON.stringify(embedding)
    ]
  );

  return result.rows[0];
}

export async function findImageEmbedding({
  imageId,
  model,
  modelVersion
}) {
  const result = await pool.query(
    `
      SELECT
        id,
        image_id,
        model,
        model_version,
        embedding,
        created_at
      FROM image_embeddings
      WHERE image_id = $1
        AND model = $2
        AND model_version = $3
    `,
    [imageId, model, modelVersion]
  );

  return result.rows[0] ?? null;
}

export async function findImageEmbeddingsByImageId(imageId) {
  const result = await pool.query(
    `
      SELECT
        id,
        image_id,
        model,
        model_version,
        embedding,
        created_at
      FROM image_embeddings
      WHERE image_id = $1
      ORDER BY created_at DESC
    `,
    [imageId]
  );

  return result.rows;
}

export async function deleteImageEmbedding({
  imageId,
  model,
  modelVersion
}) {
  const result = await pool.query(
    `
      DELETE FROM image_embeddings
      WHERE image_id = $1
        AND model = $2
        AND model_version = $3
      RETURNING id
    `,
    [imageId, model, modelVersion]
  );

  return result.rows[0] ?? null;
}

export async function findImageEmbeddingsWithMetadata({
  model,
  modelVersion
}) {
  const result = await pool.query(
    `
      SELECT
        ie.image_id,
        ie.model,
        ie.model_version,
        ie.embedding,
        im.subject,
        im.category,
        im.caption,
        im.confidence
      FROM image_embeddings ie
      JOIN image_metadata im
        ON im.image_id = ie.image_id
      WHERE ie.model = $1
        AND ie.model_version = $2
    `,
    [model, modelVersion]
  );

  return result.rows;
}