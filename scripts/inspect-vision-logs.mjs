import "dotenv/config";
import { pool } from "../app/db/pool.js";

const result = await pool.query(`
  SELECT
    job_id,
    provider,
    model,
    operation,
    success,
    COUNT(*) AS calls,
    MIN(created_at) AS first_call,
    MAX(created_at) AS last_call
  FROM ai_cost_logs
  WHERE operation = 'vision_analysis'
  GROUP BY job_id, provider, model, operation, success
  ORDER BY first_call;
`);

console.table(result.rows);

await pool.end();
