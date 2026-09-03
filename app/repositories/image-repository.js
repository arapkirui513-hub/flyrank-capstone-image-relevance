import { pool } from "../db/pool.js";

export async function createImage({ filename, category }) {
  const result = await pool.query(
    `
      INSERT INTO images (filename, category)
      VALUES ($1, $2)
      RETURNING
        id,
        filename,
        category,
        status,
        created_at,
        updated_at
    `,
    [filename, category]
  );

  return result.rows[0];
}

export async function findImageById(id) {
  const result = await pool.query(
    `
      SELECT
        id,
        filename,
        category,
        status,
        created_at,
        updated_at
      FROM images
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function findImages({ category, status, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const values = [];

  if (category) {
    values.push(category);
    conditions.push(`category = $${values.length}`);
  }

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
        filename,
        category,
        status,
        created_at,
        updated_at
      FROM images
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values
  );

  return result.rows;
}

export async function updateImageStatus(id, status) {
  const result = await pool.query(
    `
      UPDATE images
      SET
        status = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        filename,
        category,
        status,
        created_at,
        updated_at
    `,
    [id, status]
  );

  return result.rows[0] ?? null;
}