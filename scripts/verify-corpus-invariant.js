import { pool } from "../app/db/pool.js";

const result = await pool.query(`
  SELECT
    COUNT(*) AS total,
    COUNT(DISTINCT filename) AS unique_filenames,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE status = 'processing') AS processing
  FROM images
  WHERE filename LIKE 'data/images/%'
`);

console.table(result.rows);

await pool.end();
