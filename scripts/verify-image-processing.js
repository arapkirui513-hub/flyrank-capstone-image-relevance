import { pool } from "../app/db/pool.js";

const result = await pool.query(`
  SELECT
    i.id,
    i.filename,
    i.category AS image_category,
    i.status AS image_status,
    im.subject,
    im.category AS metadata_category,
    im.attributes,
    im.caption,
    im.confidence,
    ie.model AS embedding_model,
    ie.model_version AS embedding_model_version,
    jsonb_array_length(ie.embedding) AS embedding_dimensions,
    acl.operation AS cost_operation,
    acl.provider AS cost_provider,
    acl.model AS cost_model,
    acl.success AS cost_success,
    acl.duration_ms AS cost_duration_ms,
    acl.error_message AS cost_error
  FROM images i
  LEFT JOIN image_metadata im
    ON im.image_id = i.id
  LEFT JOIN image_embeddings ie
    ON ie.image_id = i.id
  LEFT JOIN LATERAL (
    SELECT
      operation,
      provider,
      model,
      success,
      duration_ms,
      error_message
    FROM ai_cost_logs
    WHERE operation = 'image_processing'
    ORDER BY created_at DESC
    LIMIT 1
  ) acl ON true
  WHERE i.status = 'completed'
  ORDER BY i.updated_at DESC
  LIMIT 1
`);

if (result.rows.length === 0) {
  console.error("No completed image-processing record found.");
  process.exitCode = 1;
} else {
  const row = result.rows[0];

  console.log("\nIMAGE PROCESSING VERIFICATION");
  console.log(JSON.stringify({
    image: {
      id: row.id,
      filename: row.filename,
      category: row.image_category,
      status: row.image_status
    },
    metadata: {
      subject: row.subject,
      category: row.metadata_category,
      attributes: row.attributes,
      caption: row.caption,
      confidence: row.confidence
    },
    embedding: {
      model: row.embedding_model,
      model_version: row.embedding_model_version,
      dimensions: row.embedding_dimensions
    },
    costLog: {
      operation: row.cost_operation,
      provider: row.cost_provider,
      model: row.cost_model,
      success: row.cost_success,
      duration_ms: row.cost_duration_ms,
      error_message: row.cost_error
    }
  }, null, 2));

  const checks = {
    imageCompleted: row.image_status === "completed",
    metadataPersisted: Boolean(row.subject && row.metadata_category),
    confidencePersisted: row.confidence !== null,
    embeddingPersisted: Boolean(row.embedding_model),
    embeddingDimensions: row.embedding_dimensions === 3072,
    costLogRecorded: row.cost_operation === "image_processing"
  };

  console.log("\nCHECKS");
  console.log(checks);

  const passed = Object.values(checks).every(Boolean);

  if (!passed) {
    console.error("\nVerification FAILED.");
    process.exitCode = 1;
  } else {
    console.log("\nVerification PASSED.");
  }
}

await pool.end();

