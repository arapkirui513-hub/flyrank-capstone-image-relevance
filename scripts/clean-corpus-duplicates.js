import { pool } from "../app/db/pool.js";

const client = await pool.connect();

try {
  await client.query("BEGIN");

  console.log("\n1. NORMALIZING CORPUS FILENAMES");

  const normalized = await client.query(`
    UPDATE images
    SET
      filename = REPLACE(filename, CHR(92), '/'),
      updated_at = NOW()
    WHERE filename LIKE 'data/images/%'
       OR filename LIKE 'data\\\\images\\\\%'
  `);

  console.log(`Normalized: ${normalized.rowCount} rows`);

  console.log("\n2. IDENTIFYING DUPLICATES");

  const duplicates = await client.query(`
    SELECT
      filename,
      COUNT(*) AS count,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed
    FROM images
    WHERE filename LIKE 'data/images/%'
    GROUP BY filename
    HAVING COUNT(*) > 1
    ORDER BY count DESC, filename
  `);

  console.log(`Duplicate filename groups: ${duplicates.rowCount}`);

  console.log("\n3. DELETING DUPLICATE IMAGE ROWS");

  const deleted = await client.query(`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY filename
          ORDER BY
            CASE WHEN status = 'completed' THEN 0 ELSE 1 END,
            updated_at DESC,
            created_at DESC,
            id
        ) AS row_number
      FROM images
      WHERE filename LIKE 'data/images/%'
    ),
    duplicates AS (
      SELECT id
      FROM ranked
      WHERE row_number > 1
    )
    DELETE FROM images
    WHERE id IN (SELECT id FROM duplicates)
    RETURNING id
  `);

  console.log(`Deleted duplicate image rows: ${deleted.rowCount}`);

  await client.query("COMMIT");

  console.log("\n4. FINAL CORPUS STATE");

  const result = await client.query(`
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

} catch (error) {
  await client.query("ROLLBACK");
  console.error("\nCLEANUP FAILED");
  console.error(error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
