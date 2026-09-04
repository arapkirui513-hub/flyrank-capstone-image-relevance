import { pool } from "../db/pool.js";

export async function createReview({
  suggestionId,
  decision,
  reason = null
}) {
  const result = await pool.query(
    `
      INSERT INTO reviews (
        suggestion_id,
        decision,
        reason
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        suggestion_id,
        decision,
        reason,
        reviewed_at
    `,
    [suggestionId, decision, reason]
  );

  return result.rows[0];
}

export async function findReviewById(id) {
  const result = await pool.query(
    `
      SELECT
        id,
        suggestion_id,
        decision,
        reason,
        reviewed_at
      FROM reviews
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function findReviewsBySuggestionId(suggestionId) {
  const result = await pool.query(
    `
      SELECT
        id,
        suggestion_id,
        decision,
        reason,
        reviewed_at
      FROM reviews
      WHERE suggestion_id = $1
      ORDER BY reviewed_at DESC
    `,
    [suggestionId]
  );

  return result.rows;
}

export async function deleteReview(id) {
  const result = await pool.query(
    `
      DELETE FROM reviews
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );

  return result.rows[0] ?? null;
}