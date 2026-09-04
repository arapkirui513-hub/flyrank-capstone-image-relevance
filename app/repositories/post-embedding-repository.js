import { pool } from "../db/pool.js";

export async function createPostEmbedding({
  postId,
  model,
  modelVersion,
  embedding
}) {
  const result = await pool.query(
    `
      INSERT INTO post_embeddings (
        post_id,
        model,
        model_version,
        embedding
      )
      VALUES ($1, $2, $3, $4::jsonb)
      RETURNING
        id,
        post_id,
        model,
        model_version,
        embedding,
        created_at
    `,
    [
      postId,
      model,
      modelVersion,
      JSON.stringify(embedding)
    ]
  );

  return result.rows[0];
}

export async function findPostEmbedding({
  postId,
  model,
  modelVersion
}) {
  const result = await pool.query(
    `
      SELECT
        id,
        post_id,
        model,
        model_version,
        embedding,
        created_at
      FROM post_embeddings
      WHERE post_id = $1
        AND model = $2
        AND model_version = $3
    `,
    [postId, model, modelVersion]
  );

  return result.rows[0] ?? null;
}

export async function findPostEmbeddingsByPostId(postId) {
  const result = await pool.query(
    `
      SELECT
        id,
        post_id,
        model,
        model_version,
        embedding,
        created_at
      FROM post_embeddings
      WHERE post_id = $1
      ORDER BY created_at DESC
    `,
    [postId]
  );

  return result.rows;
}

export async function deletePostEmbedding({
  postId,
  model,
  modelVersion
}) {
  const result = await pool.query(
    `
      DELETE FROM post_embeddings
      WHERE post_id = $1
        AND model = $2
        AND model_version = $3
      RETURNING id
    `,
    [postId, model, modelVersion]
  );

  return result.rows[0] ?? null;
}