const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

(async () => {
  try {
    const { rows: toDelete } = await pool.query(
      "SELECT id, filename FROM images WHERE filename ~ '^(join|embedding|metadata)-test-[0-9]+\\.jpg$'"
    );
    console.log(`About to delete ${toDelete.length} test-fixture image rows:`);
    console.table(toDelete);

    if (toDelete.length !== 17) {
      console.error(`Expected 17 rows, found ${toDelete.length}. Stopping without deleting -- check the pattern before proceeding.`);
      process.exitCode = 1;
      return;
    }

    const ids = toDelete.map((r) => r.id);

    await pool.query("DELETE FROM image_embeddings WHERE image_id = ANY($1)", [ids]);
    await pool.query("DELETE FROM image_metadata WHERE image_id = ANY($1)", [ids]);
    const { rowCount } = await pool.query("DELETE FROM images WHERE id = ANY($1)", [ids]);

    console.log(`Deleted ${rowCount} image rows and their associated metadata/embeddings.`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();