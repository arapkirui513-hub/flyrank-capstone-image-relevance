import { pool } from "../db/pool.js";

export async function createJob({
  jobType,
  totalItems = 0
}) {
  const result = await pool.query(
    `
      INSERT INTO jobs (
        job_type,
        total_items
      )
      VALUES ($1, $2)
      RETURNING
        id,
        job_type,
        status,
        total_items,
        processed_items,
        failed_items,
        attempts,
        error_message,
        created_at,
        started_at,
        completed_at
    `,
    [jobType, totalItems]
  );

  return result.rows[0];
}

export async function findJobById(id) {
  const result = await pool.query(
    `
      SELECT
        id,
        job_type,
        status,
        total_items,
        processed_items,
        failed_items,
        attempts,
        error_message,
        created_at,
        started_at,
        completed_at
      FROM jobs
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function findJobs({
  status,
  limit = 50,
  offset = 0
} = {}) {
  const conditions = [];
  const values = [];

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
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
        job_type,
        status,
        total_items,
        processed_items,
        failed_items,
        attempts,
        error_message,
        created_at,
        started_at,
        completed_at
      FROM jobs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values
  );

  return result.rows;
}

export async function updateJobStatus(id, status) {
  const result = await pool.query(
    `
      UPDATE jobs
      SET
        status = $2,
        started_at = CASE
          WHEN $2 = 'running' AND started_at IS NULL
          THEN NOW()
          ELSE started_at
        END,
        completed_at = CASE
          WHEN $2 IN ('completed', 'failed')
          THEN NOW()
          ELSE completed_at
        END
      WHERE id = $1
      RETURNING
        id,
        job_type,
        status,
        total_items,
        processed_items,
        failed_items,
        attempts,
        error_message,
        created_at,
        started_at,
        completed_at
    `,
    [id, status]
  );

  return result.rows[0] ?? null;
}

export async function updateJobProgress(
  id,
  {
    processedItems,
    failedItems
  }
) {
  const result = await pool.query(
    `
      UPDATE jobs
      SET
        processed_items = $2,
        failed_items = $3
      WHERE id = $1
      RETURNING
        id,
        job_type,
        status,
        total_items,
        processed_items,
        failed_items,
        attempts,
        error_message,
        created_at,
        started_at,
        completed_at
    `,
    [id, processedItems, failedItems]
  );

  return result.rows[0] ?? null;
}

export async function incrementJobAttempts(id) {
  const result = await pool.query(
    `
      UPDATE jobs
      SET attempts = attempts + 1
      WHERE id = $1
      RETURNING
        id,
        job_type,
        status,
        total_items,
        processed_items,
        failed_items,
        attempts,
        error_message,
        created_at,
        started_at,
        completed_at
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function setJobError(id, errorMessage) {
  const result = await pool.query(
    `
      UPDATE jobs
      SET
        status = 'failed',
        error_message = $2,
        completed_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        job_type,
        status,
        total_items,
        processed_items,
        failed_items,
        attempts,
        error_message,
        created_at,
        started_at,
        completed_at
    `,
    [id, errorMessage]
  );

  return result.rows[0] ?? null;
}

export async function deleteJob(id) {
  const result = await pool.query(
    `
      DELETE FROM jobs
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );

  return result.rows[0] ?? null;
}