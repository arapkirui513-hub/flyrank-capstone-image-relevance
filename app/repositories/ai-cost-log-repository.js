import { pool } from "../db/pool.js";

export async function createAiCostLog({
  jobId = null,
  operation,
  provider,
  model,
  inputTokens = null,
  outputTokens = null,
  durationMs,
  estimatedCostUsd = null,
  success,
  errorMessage = null
}) {
  const result = await pool.query(
    `
      INSERT INTO ai_cost_logs (
        job_id,
        operation,
        provider,
        model,
        input_tokens,
        output_tokens,
        duration_ms,
        estimated_cost_usd,
        success,
        error_message
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10
      )
      RETURNING
        id,
        job_id,
        operation,
        provider,
        model,
        input_tokens,
        output_tokens,
        duration_ms,
        estimated_cost_usd,
        success,
        error_message,
        created_at
    `,
    [
      jobId,
      operation,
      provider,
      model,
      inputTokens,
      outputTokens,
      durationMs,
      estimatedCostUsd,
      success,
      errorMessage
    ]
  );

  return result.rows[0];
}

export async function findAiCostLogById(id) {
  const result = await pool.query(
    `
      SELECT
        id,
        job_id,
        operation,
        provider,
        model,
        input_tokens,
        output_tokens,
        duration_ms,
        estimated_cost_usd,
        success,
        error_message,
        created_at
      FROM ai_cost_logs
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function findAiCostLogs({
  jobId,
  limit = 50,
  offset = 0
} = {}) {
  const conditions = [];
  const values = [];

  if (jobId) {
    values.push(jobId);
    conditions.push(`job_id = $${values.length}`);
  }

  values.push(limit);
  const limitParam = values.length;

  values.push(offset);
  const offsetParam = values.length;

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await pool.query(
    `
      SELECT
        id,
        job_id,
        operation,
        provider,
        model,
        input_tokens,
        output_tokens,
        duration_ms,
        estimated_cost_usd,
        success,
        error_message,
        created_at
      FROM ai_cost_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values
  );

  return result.rows;
}

export async function deleteAiCostLog(id) {
  const result = await pool.query(
    `
      DELETE FROM ai_cost_logs
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );

  return result.rows[0] ?? null;
}