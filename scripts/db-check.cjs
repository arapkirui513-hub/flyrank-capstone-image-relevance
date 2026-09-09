const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const queries = [
  ["total images (no filter)", "SELECT COUNT(*) FROM images"],
  ["images by status", "SELECT status, COUNT(*) FROM images GROUP BY status ORDER BY status"],
  ["metadata row count", "SELECT COUNT(*) FROM image_metadata"],
  ["distinct image_ids in metadata", "SELECT COUNT(DISTINCT image_id) FROM image_metadata"],
  ["metadata orphans", "SELECT im.image_id FROM image_metadata im LEFT JOIN images i ON i.id = im.image_id WHERE i.id IS NULL"],
  ["embedding row count", "SELECT COUNT(*) FROM image_embeddings"],
  ["distinct image_ids in embeddings", "SELECT COUNT(DISTINCT image_id) FROM image_embeddings"],
  ["embedding orphans", "SELECT ie.image_id FROM image_embeddings ie LEFT JOIN images i ON i.id = ie.image_id WHERE i.id IS NULL"],
  ["metadata duplicates", "SELECT image_id, COUNT(*) FROM image_metadata GROUP BY image_id HAVING COUNT(*) > 1"],
  ["embedding duplicates", "SELECT image_id, model, model_version, COUNT(*) FROM image_embeddings GROUP BY image_id, model, model_version HAVING COUNT(*) > 1"]
];

(async () => {
  try {
    for (const [label, query] of queries) {
      const { rows } = await pool.query(query);
      console.log("\n-- " + label);
      console.table(rows);
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
