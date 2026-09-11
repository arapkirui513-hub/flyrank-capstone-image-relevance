import { pool } from "../app/db/pool.js";
import GeminiEmbeddingProvider from "../app/services/providers/gemini-embedding-provider.js";

const embeddingModel =
  process.env.EMBEDDING_MODEL || "gemini-embedding-001";

const embeddingModelVersion =
  process.env.EMBEDDING_MODEL_VERSION || "1";

async function seed() {
  const embeddingProvider = new GeminiEmbeddingProvider({
    apiKey: process.env.GEMINI_API_KEY,
    model: embeddingModel
  });

  const imageText =
    "A patient monitor displaying vital signs at a hospital bedside.";

  const postText =
    "A hospital patient monitor displaying vital signs.";

  const embeddingResult =
    await embeddingProvider.embedText(imageText);

  const postEmbeddingResult =
    await embeddingProvider.embedText(postText);

  await pool.query("BEGIN");

  try {
    const imageFilename = "seed-demo-patient-monitor.jpg";

    let imageResult = await pool.query(
      `
        SELECT id, filename, category
        FROM images
        WHERE filename = $1
        LIMIT 1
      `,
      [imageFilename]
    );

    let image = imageResult.rows[0];

    if (!image) {
      imageResult = await pool.query(
        `
          INSERT INTO images (filename, category)
          VALUES ($1, $2)
          RETURNING id, filename, category
        `,
        [imageFilename, "medical_equipment"]
      );

      image = imageResult.rows[0];
    }

    await pool.query(
      `
        INSERT INTO image_metadata (
          image_id,
          subject,
          category,
          attributes,
          caption,
          confidence
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, $6)
        ON CONFLICT (image_id)
        DO UPDATE SET
          subject = EXCLUDED.subject,
          category = EXCLUDED.category,
          attributes = EXCLUDED.attributes,
          caption = EXCLUDED.caption,
          confidence = EXCLUDED.confidence
      `,
      [
        image.id,
        "patient monitor",
        "medical_equipment",
        JSON.stringify([
          "bedside",
          "vital signs",
          "display"
        ]),
        "A patient monitor displaying vital signs.",
        0.95
      ]
    );

    await pool.query(
      `
        INSERT INTO image_embeddings (
          image_id,
          model,
          model_version,
          embedding
        )
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (image_id, model, model_version)
        DO UPDATE SET
          embedding = EXCLUDED.embedding
      `,
      [
        image.id,
        embeddingModel,
        embeddingModelVersion,
        JSON.stringify(embeddingResult.data)
      ]
    );

    const postTitle = "Patient monitoring equipment";

    let postResult = await pool.query(
      `
        SELECT id, title, content
        FROM posts
        WHERE title = $1
        LIMIT 1
      `,
      [postTitle]
    );

    let post = postResult.rows[0];

    if (!post) {
      postResult = await pool.query(
        `
          INSERT INTO posts (title, content)
          VALUES ($1, $2)
          RETURNING id, title, content
        `,
        [
          postTitle,
          postText
        ]
      );

      post = postResult.rows[0];
    }

    await pool.query(
      `
        INSERT INTO post_embeddings (
          post_id,
          model,
          model_version,
          embedding
        )
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (post_id, model, model_version)
        DO UPDATE SET
          embedding = EXCLUDED.embedding
      `,
      [
        post.id,
        embeddingModel,
        embeddingModelVersion,
        JSON.stringify(postEmbeddingResult.data)
      ]
    );

    await pool.query("COMMIT");

    console.log("Seed complete.");
    console.log(`Image ID: ${image.id}`);
    console.log(`Post ID: ${post.id}`);
    console.log(`Embedding dimensions: ${embeddingResult.data.length}`);
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

try {
  await seed();
} finally {
  await pool.end();
}