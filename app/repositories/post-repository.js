import { pool } from "../db/pool.js";

export async function createPost({ title, content }) {
  const result = await pool.query(
    `
      INSERT INTO posts (
        title,
        content
      )
      VALUES ($1, $2)
      RETURNING
        id,
        title,
        content,
        created_at,
        updated_at
    `,
    [title, content]
  );

  return result.rows[0];
}

export async function findPostById(id) {
  const result = await pool.query(
    `
      SELECT
        id,
        title,
        content,
        created_at,
        updated_at
      FROM posts
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function findPosts({
  limit = 50,
  offset = 0
} = {}) {
  const result = await pool.query(
    `
      SELECT
        id,
        title,
        content,
        created_at,
        updated_at
      FROM posts
      ORDER BY created_at DESC
      LIMIT $1
      OFFSET $2
    `,
    [limit, offset]
  );

  return result.rows;
}

export async function updatePost(id, { title, content }) {
  const result = await pool.query(
    `
      UPDATE posts
      SET
        title = $2,
        content = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        title,
        content,
        created_at,
        updated_at
    `,
    [id, title, content]
  );

  return result.rows[0] ?? null;
}

export async function deletePost(id) {
  const result = await pool.query(
    `
      DELETE FROM posts
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );

  return result.rows[0] ?? null;
}