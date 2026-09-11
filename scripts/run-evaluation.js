import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

import { pool } from "../app/db/pool.js";
import { createPost } from "../app/repositories/post-repository.js";
import { createPostEmbedding } from "../app/repositories/post-embedding-repository.js";
import { createSuggestion } from "../app/repositories/suggestion-repository.js";
import { PostEmbeddingService } from "../app/services/post-embedding-service.js";
import { MatchingService } from "../app/services/matching-service.js";
import { MismatchGuardService } from "../app/services/mismatch-guard-service.js";
import { SuggestionGenerationService } from "../app/services/suggestion-generation-service.js";
import GeminiEmbeddingProvider from "../app/services/providers/gemini-embedding-provider.js";

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

async function loadManifest() {
  const csv = await fs.readFile(
    path.resolve("data/evaluation.csv"),
    "utf8"
  );

  const lines = csv
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  const headers = parseCsvLine(lines[0]).map((header) =>
  header.replace(/^\uFEFF/, "")
);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);

    return Object.fromEntries(
      headers.map((header, index) => [
        header,
        values[index] ?? ""
      ])
    );
  });
}

async function loadGroundTruth() {
  const result = await pool.query(`
    SELECT
      i.id,
      i.filename,
      i.category,
      m.subject,
      m.confidence
    FROM images i
    INNER JOIN image_metadata m
      ON m.image_id = i.id
    WHERE i.status = 'completed'
  `);

  const datasetCsv = await fs.readFile(
    path.resolve("data/dataset.csv"),
    "utf8"
  );

  const lines = datasetCsv
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  const headers = parseCsvLine(lines[0]).map((header) =>
  header.replace(/^\uFEFF/, "")
);

  const dataset = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);

    return Object.fromEntries(
      headers.map((header, index) => [
        header,
        values[index] ?? ""
      ])
    );
  });

  const labels = new Map();

  for (const row of dataset) {
    if (
      row.status !== "positive" &&
      row.status !== "hard_negative"
    ) {
      continue;
    }

    const normalized = row.filename
      .replaceAll("\\", "/")
      .replace(/\.[^.]+$/, "");

    labels.set(normalized, {
      datasetId: row.id,
      subject: row.subject,
      status: row.status
    });

    labels.set(
      normalized.replace(/_normalized$/, ""),
      {
        datasetId: row.id,
        subject: row.subject,
        status: row.status
      }
    );
  }

  return { images: result.rows, labels };
}

function getImageGroundTruth(image, labels) {
  const normalized = image.filename
    .replaceAll("\\", "/")
    .replace(/\.[^.]+$/, "");

  return (
    labels.get(normalized) ??
    labels.get(normalized.replace(/_normalized$/, "")) ??
    null
  );
}

function getOptionalNumber(value) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const manifest = await loadManifest();
const { images, labels } = await loadGroundTruth();

const embeddingModel =
  process.env.EMBEDDING_MODEL || "gemini-embedding-001";

const embeddingModelVersion =
  process.env.EMBEDDING_MODEL_VERSION || "live";

const embeddingProvider = new GeminiEmbeddingProvider();

const aiCostLogRepository = {
  createAiCostLog: async (data) => {
    await pool.query(
      `
        INSERT INTO ai_cost_logs (
          job_id,
          operation,
          provider,
          model,
          input_tokens,
          output_tokens,
          duration_ms,
          estimated_cost_usd,
          success,
          error_message
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
        )
      `,
      [
        data.jobId,
        data.operation,
        data.provider,
        data.model,
        data.inputTokens,
        data.outputTokens,
        data.durationMs,
        data.estimatedCostUsd,
        data.success,
        data.errorMessage
      ]
    );
  }
};

const postEmbeddingRepository = {
  createPostEmbedding,
  findPostEmbedding: async ({
    postId,
    model,
    modelVersion
  }) => {
    const result = await pool.query(
      `
        SELECT
          id,
          post_id,
          model,
          model_version,
          embedding,
          created_at
        FROM post_embeddings
        WHERE post_id = $1
          AND model = $2
          AND model_version = $3
      `,
      [postId, model, modelVersion]
    );

    return result.rows[0] ?? null;
  }
};

const postRepository = {
  findPostById: async (id) => {
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
};

const imageEmbeddingRepository = {
  findImageEmbeddingsWithMetadata: async ({
    model,
    modelVersion
  }) => {
    const result = await pool.query(
      `
        SELECT
          e.image_id,
          i.filename,
          e.embedding,
          m.subject,
          m.category,
          m.confidence
        FROM image_embeddings e
        INNER JOIN images i
          ON i.id = e.image_id
        INNER JOIN image_metadata m
          ON m.image_id = e.image_id
        WHERE e.model = $1
          AND e.model_version = $2
          AND i.status = 'completed'
          AND i.category <> 'evaluation_images'
      `,
      [model, modelVersion]
    );

    const seen = new Set();

    return result.rows.filter((row) => {
      const normalized = row.filename
        .replaceAll("\\", "/")
        .replace(/\.[^.]+$/, "")
        .replace(/_normalized$/, "");

      const truth = labels.get(normalized);

      if (!truth) {
        return false;
      }

      if (seen.has(truth.datasetId)) {
        return false;
      }

      seen.add(truth.datasetId);
      return true;
    });
  }
};

const suggestionRepository = {
  createSuggestion
};

const postEmbeddingService = new PostEmbeddingService({
  postRepository,
  postEmbeddingRepository,
  aiCostLogRepository,
  embeddingProvider,
  embeddingModel,
  embeddingModelVersion,
  embeddingProviderName: "gemini",
  embeddingInputCostPerMillion: getOptionalNumber(
    process.env.GEMINI_EMBEDDING_INPUT_COST_PER_MILLION
  ),
  embeddingOutputCostPerMillion: getOptionalNumber(
    process.env.GEMINI_EMBEDDING_OUTPUT_COST_PER_MILLION
  )
});

const matchingService = new MatchingService({
  postEmbeddingRepository,
  imageEmbeddingRepository,
  model: embeddingModel,
  modelVersion: embeddingModelVersion
});

const mismatchGuardService = new MismatchGuardService();

const suggestionGenerationService =
  new SuggestionGenerationService({
    matchingService,
    mismatchGuardService,
    suggestionRepository,
    guardVersion: process.env.GUARD_VERSION || "1"
  });



console.log("\nEVALUATION");
console.log(`Posts: ${manifest.length}`);
console.log(`Processed images: ${images.length}`);

const evaluationRows = [];

for (const item of manifest) {
  console.log(
    `\n${item.id} | expected=${item.expected_subject}`
  );

  const post = await createPost({
    title: `[EVAL] ${item.title}`,
    content: item.content
  });

  await postEmbeddingService.embedPost(post.id);

  const results =
    await suggestionGenerationService.generateForPost(
      post.id,
      {
        expectedSubject: item.expected_subject,
        limit: 10
      }
    );

  let accepted = 0;
  let rejected = 0;
  let truePositive = 0;
  let falsePositive = 0;
  let retrievalTruePositive = 0;

  for (const result of results) {
    const truth = getImageGroundTruth(
      images.find((image) => image.id === result.imageId) ?? {},
      labels
    );

    const isRelevant =
  truth?.status === "positive" &&
  truth?.subject === item.expected_subject;

if (isRelevant) {
  retrievalTruePositive += 1;
}

const isAccepted =
  result.guardDecision === "accepted";

    if (isAccepted) {
      accepted += 1;

      if (isRelevant) {
        truePositive += 1;
      } else {
        falsePositive += 1;
      }
    } else {
      rejected += 1;
    }
  }

  const precision =
    accepted > 0
      ? truePositive / accepted
      : null;

  const retrievalPrecisionAt10 =
  results.length > 0
    ? retrievalTruePositive / results.length
    : null;

  console.log(
  `accepted=${accepted} rejected=${rejected} ` +
  `retrievalTP=${retrievalTruePositive} ` +
  `retrievalPrecision@10=${
    retrievalPrecisionAt10 === null
      ? "n/a"
      : retrievalPrecisionAt10.toFixed(4)
  } ` +
  `guardTP=${truePositive} guardFP=${falsePositive} ` +
  `guardedPrecision=${
    precision === null
      ? "n/a"
      : precision.toFixed(4)
  }`
);

  evaluationRows.push({
  id: item.id,
  postId: post.id,
  expectedSubject: item.expected_subject,
  candidates: results.length,
  accepted,
  rejected,
  retrievalTruePositive,
  retrievalPrecisionAt10,
  truePositive,
  falsePositive,
  guardedPrecision: precision
});
}

const totalAccepted = evaluationRows.reduce(
  (sum, row) => sum + row.accepted,
  0
);

const totalTruePositive = evaluationRows.reduce(
  (sum, row) => sum + row.truePositive,
  0
);

const totalFalsePositive = evaluationRows.reduce(
  (sum, row) => sum + row.falsePositive,
  0
);

const totalCandidates = evaluationRows.reduce(
  (sum, row) => sum + row.candidates,
  0
);

const totalRetrievalTruePositive =
  evaluationRows.reduce(
    (sum, row) => sum + row.retrievalTruePositive,
    0
  );

const retrievalPrecisionAt10 =
  totalCandidates > 0
    ? totalRetrievalTruePositive / totalCandidates
    : null;

const overallPrecision =
  totalAccepted > 0
    ? totalTruePositive / totalAccepted
    : null;

console.log("\nEVALUATION SUMMARY");
console.log(`Posts evaluated: ${evaluationRows.length}`);
console.log(`Candidates evaluated: ${totalCandidates}`);
console.log(
  `Retrieved true positives: ${totalRetrievalTruePositive}`
);
console.log(
  `Retrieval Precision@10: ${
    retrievalPrecisionAt10 === null
      ? "n/a"
      : retrievalPrecisionAt10.toFixed(4)
  }`
);
console.log(`Accepted: ${totalAccepted}`);
console.log(`True positives: ${totalTruePositive}`);
console.log(`False positives: ${totalFalsePositive}`);
console.log(
  `Guarded precision: ${
    overallPrecision === null
      ? "n/a"
      : overallPrecision.toFixed(4)
  }`
);

await fs.writeFile(
  path.resolve("data/evaluation-results.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      embeddingModel,
      embeddingModelVersion,
      guardVersion: process.env.GUARD_VERSION || "1",
      topK: 10,
      posts: evaluationRows,
      overall: {
  candidates: totalCandidates,
  retrievalTruePositive: totalRetrievalTruePositive,
  retrievalPrecisionAt10,
  accepted: totalAccepted,
  truePositive: totalTruePositive,
  falsePositive: totalFalsePositive,
  guardedPrecision: overallPrecision
}
    },
    null,
    2
  ),
  "utf8"
);

console.log(
  "\nWrote data/evaluation-results.json"
);

await pool.end();
