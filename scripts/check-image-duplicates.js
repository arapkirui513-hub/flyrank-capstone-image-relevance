import { pool } from "../app/db/pool.js";

const result = await pool.query(`
  SELECT
    REPLACE(filename, CHR(92), '/') AS filename,
    COUNT(*) AS count,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed
  FROM images
  GROUP BY REPLACE(filename, CHR(92), '/')
  ORDER BY count DESC, filename
`);

console.table(result.rows);

await pool.end();
