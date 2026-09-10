import { pool } from "../db/pool.js";

export async function createSuggestion({
  postId,
  imageId,
  similarityScore,
  guardDecision,
  rejectionReason = null,
  guardVersion
}) {
  const result = await pool.query(
    `
      INSERT INTO suggestions (
        post_id,
        image_id,
        similarity_score,
        guard_decision,
        rejection_reason,
        guard_version
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        post_id,
        image_id,
        similarity_score,
        guard_decision,
        rejection_reason,
        guard_version,
        created_at
    `,
    [
      postId,
      imageId,
      similarityScore,
      guardDecision,
      rejectionReason,
      guardVersion
    ]
  );

  return result.rows[0];
}

export async function findSuggestionById(id) {
  const result = await pool.query(
    `
      SELECT
        id,
        post_id,
        image_id,
        similarity_score,
        guard_decision,
        rejection_reason,
        guard_version,
        created_at
      FROM suggestions
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function findSuggestions({
  postId,
  imageId,
  guardDecision,
  limit = 50,
  offset = 0
} = {}) {
  const conditions = [];
  const values = [];

  if (postId) {
    values.push(postId);
    conditions.push(`post_id = $${values.length}`);
  }

  if (imageId) {
    values.push(imageId);
    conditions.push(`image_id = $${values.length}`);
  }

  if (guardDecision) {
    values.push(guardDecision);
    conditions.push(`guard_decision = $${values.length}`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  values.push(limit);
  const limitParam = values.length;

  values.push(offset);
  const offsetParam = values.length;

  const result = await pool.query(
    `
      SELECT
        id,
        post_id,
        image_id,
        similarity_score,
        guard_decision,
        rejection_reason,
        guard_version,
        created_at
      FROM suggestions
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values
  );

  return result.rows;
}

export async function findImagesByPostId(postId, {
  limit = 50,
  offset = 0
} = {}) {
  const result = await pool.query(
    `
      SELECT
        i.id,
        i.filename,
        i.category,
        i.status,
        i.created_at,
        i.updated_at,
        s.id AS suggestion_id,
        s.similarity_score,
        s.guard_decision,
        s.rejection_reason,
        s.guard_version,
        s.created_at AS suggestion_created_at
      FROM suggestions s
      INNER JOIN images i
        ON i.id = s.image_id
      WHERE s.post_id = $1
      ORDER BY s.created_at DESC
      LIMIT $2
      OFFSET $3
    `,
    [postId, limit, offset]
  );

  return result.rows;
}

export async function deleteSuggestion(id) {
  const result = await pool.query(
    `
      DELETE FROM suggestions
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );

  return result.rows[0] ?? null;
}
