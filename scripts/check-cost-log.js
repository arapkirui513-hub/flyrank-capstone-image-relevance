import { pool } from "../app/db/pool.js";

const result = await pool.query(
  `
    SELECT
      operation,
      provider,
      model,
      success,
      error_message,
      duration_ms,
      created_at
    FROM ai_cost_logs
    WHERE operation = $1
    ORDER BY created_at DESC
    LIMIT 3
  `,
  ["image_processing"]
);

console.log(result.rows);

await pool.end();

