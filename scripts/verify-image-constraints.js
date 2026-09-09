import { pool } from "../app/db/pool.js";

const result = await pool.query(`
  SELECT
    constraint_name,
    constraint_type
  FROM information_schema.table_constraints
  WHERE table_name = 'images'
  ORDER BY constraint_name
`);

console.table(result.rows);

await pool.end();
