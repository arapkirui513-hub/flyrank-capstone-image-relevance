import { pool } from "../app/db/pool.js";

const result = await pool.query(`
  SELECT
    i.filename,
    i.status,
    CASE WHEN im.image_id IS NOT NULL THEN 'yes' ELSE 'no' END AS metadata,
    CASE WHEN ie.image_id IS NOT NULL THEN 'yes' ELSE 'no' END AS embedding
  FROM images i
  LEFT JOIN image_metadata im
    ON im.image_id = i.id
  LEFT JOIN image_embeddings ie
    ON ie.image_id = i.id
  WHERE i.filename LIKE 'data/images/%'
  ORDER BY i.filename
`);

console.table(result.rows);

console.log("\nCOMPLETED WITHOUT METADATA/EMBEDDING");

console.table(
  result.rows.filter(
    (row) =>
      row.status === "completed" &&
      (row.metadata !== "yes" || row.embedding !== "yes")
  )
);

await pool.end();
