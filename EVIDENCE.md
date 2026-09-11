# EVIDENCE

This file contains concrete proof for the capstone requirements.

Evidence is recorded only after functionality has been implemented and verified.

## Phase 1

### Design document

Status: VERIFIED

Evidence:
- `docs/design.md`

### Dataset

Status: VERIFIED

Verified corpus categories:
- patient_monitor
- defibrillator
- sterilizer
- hospital_bed

Verified corpus total:
- 43 images

Evidence:
- Wikimedia Commons provenance audit
- Per-image source/license verification
- Two verified public-domain replacement images
- Three GPL-licensed sterilizer images excluded from the final corpus
- `scripts/db-check.cjs`
- `scripts/verify-corpus-invariant.js`
- `scripts/check-image-duplicates.js`
- `scripts/verify-clean-corpus.js`

Final database verification:

```text
total images: 43

images by status:
completed: 43

metadata row count: 43
distinct image_ids in metadata: 43
metadata orphans: 0

embedding row count: 43
distinct image_ids in embeddings: 43
embedding orphans: 0

metadata duplicates: 0
embedding duplicates: 0
```

## Section 6 Requirements

### 1. Vision structured output + schema validation

Status: VERIFIED

Evidence:
- Vision metadata schema tests pass.
- Gemini vision provider tests pass.
- Groq vision provider tests pass.
- Image-processing tests verify structured metadata persistence.
- Full test suite: 89/89 passing.

### 2. Low-confidence classification handling

Status: VERIFIED

Evidence:
- Vision metadata schema constrains confidence to 0-1.
- Image-processing tests verify confidence handling.
- Mismatch guard tests verify low-confidence classification behavior.
- Full test suite: 89/89 passing.

### 3. Batch processing + retries

Status: VERIFIED

Evidence:
- `scripts/process-image-corpus.js`
- Image processing jobs track total, processed, failed, and retry attempts.
- Repeated processing reuses existing image records.
- Completed images are skipped.
- Database-level filename uniqueness prevents duplicate image identities.
- Full test suite: 89/89 passing.

### 4. Embeddings and semantic matching

Status: VERIFIED

Evidence:
- Gemini embedding provider implements the embedding contract.
- Image embedding persistence is verified by repository tests.
- Matching service tests verify cosine-similarity ranking, limits, missing embeddings, dimension mismatch, and zero-magnitude vectors.
- 43 real corpus image embeddings are persisted in PostgreSQL.
- The completed evaluation used the real persisted image embeddings and real generated post embeddings.
- Evaluation runner: `scripts/run-evaluation.js`

### 5. Mismatch guard

Status: VERIFIED

Evidence:
- Guard tests cover:
  - sufficient similarity;
  - low vision confidence;
  - confidence precedence;
  - similarity threshold;
  - null similarity;
  - subject mismatch;
  - evaluation order;
  - exact threshold values.
- Current thresholds:
  - confidence: `0.70`
  - similarity: `0.65`
- Real-corpus evaluation exercised the guard across 12 evaluation posts and 120 retrieved candidates.

Important limitation:
- Several patient-monitor hard negatives were classified by the vision model as patient monitors with high confidence.
- Because those candidates also satisfied the similarity floor and subject compatibility check, some were accepted.
- This is a vision-classification failure mode rather than a case where the guard ignores the similarity threshold.

### 6. Human-readable rejection

Status: VERIFIED

Evidence:
- Guard results include rejection reasons.
- Rejected suggestions persist a non-empty rejection reason.
- Repository tests verify rejection reason persistence.
- Full test suite: 89/89 passing.

### 7. No-confident-match behavior

Status: VERIFIED

Evidence:
- Low-confidence and insufficient-similarity guard paths are covered by tests.
- `no_confident_match` is an internal safe-rejection result.
- Suggestion generation does not persist `no_confident_match` as an accepted/rejected suggestion.
- Full test suite: 89/89 passing.

### 8. Persistence

Status: VERIFIED

Evidence:
- PostgreSQL repositories persist and retrieve:
  - images;
  - image metadata;
  - image embeddings;
  - posts;
  - post embeddings;
  - suggestions;
  - reviews;
  - jobs;
  - AI cost logs.
- Full repository test suite passes.
- Real corpus verification confirms:
  - 43 image rows;
  - 43 metadata rows;
  - 43 embedding rows;
  - 0 metadata orphans;
  - 0 embedding orphans;
  - 0 metadata duplicates;
  - 0 embedding duplicates.

### 9. Review API live verification

Status: VERIFIED

Live Docker/PostgreSQL verification was completed against real persisted suggestions.

Approve flow:

- `GET /suggestions/987313cd-23c2-41c5-a362-89b668319dc3` returned the persisted suggestion.
- `POST /suggestions/987313cd-23c2-41c5-a362-89b668319dc3/approve` succeeded.
- Follow-up `GET /suggestions/987313cd-23c2-41c5-a362-89b668319dc3` returned:
  - review decision: `approved`
  - review ID: `a8572a79-27af-49b6-a0c4-fa1f583ef0e1`

Reject flow:

- `POST /suggestions/8b89f270-794c-4914-b101-3c18308a5211/reject` succeeded.
- Rejection reason was persisted.
- Follow-up `GET /suggestions/8b89f270-794c-4914-b101-3c18308a5211` returned:
  - guard decision: `rejected`
  - rejection reason: `Subject mismatch: expected patient monitor, detected cardiac monitor.`
  - review decision: `rejected`
  - review ID: `64575704-17bc-4c57-88e3-148d0fc2667f`

The live verification was performed after fixing the evaluator seed to generate real `gemini-embedding-001` vectors. The seeded vectors were verified at 3072 dimensions and suggestion generation completed successfully.

### 10. Evaluation dataset and precision

Status: VERIFIED

Evidence:
- `data/evaluation.csv`
- `scripts/run-evaluation.js`
- `data/evaluation-results.json` generated from the completed evaluation.
- Evaluation used 12 posts:
  - 3 defibrillator posts;
  - 3 hospital-bed posts;
  - 3 patient-monitor posts;
  - 3 sterilizer posts.
- Top-K: 10.
- Candidates evaluated: 120.
- Real completed image embeddings were used for retrieval.
- Ground-truth labels came from `data/dataset.csv`, not model predictions.

Overall evaluation:

| Metric                   |     Result |
| ------------------------ | ---------: |
| Evaluation posts         |         12 |
| Candidates evaluated     |        120 |
| Retrieval true positives |         72 |
| Retrieval Precision@10   | **60.00%** |
| Accepted suggestions     |         45 |
| Accepted true positives  |         30 |
| Accepted false positives |         15 |
| Guarded precision        | **66.67%** |

Per subject:

| Subject         | Retrieval Precision@10 | Guarded Precision |
| --------------- | ---------------------: | ----------------: |
| Defibrillator   |                 80.00% |           100.00% |
| Hospital bed    |                 40.00% |           100.00% |
| Patient monitor |                 20.00% |            28.57% |
| Sterilizer      |                100.00% |           100.00% |

Interpretation:
- The guard improves precision for three of the four evaluated subjects.
- Patient monitor is the main weakness.
- Several patient-monitor hard negatives received high-confidence patient-monitor classifications from the vision model.
- The evaluation therefore exposes a genuine model/classification weakness rather than hiding it through threshold tuning.
- Recall is not reported because the evaluation does not guarantee that every labeled positive image is present in the completed candidate set.

### 11. AI cost tracking

Status: VERIFIED

Evidence:
- AI cost log repository persists successful and failed operations.
- Tests cover retrieval, filtering, deletion, nullable usage/cost on failures, and job references.
- Image processing logs vision and embedding calls independently.
- Post-embedding logs embedding calls independently.
- Full test suite: 89/89 passing.

## Database integrity

### Filename uniqueness

Status: VERIFIED

The `UNIQUE(filename)` database constraint exists as an active PostgreSQL constraint on `images.filename`.

Evidence:
- `migrations/002_image_identity_constraints.sql`
- `scripts/verify-image-constraints.js`

The constraint was checked against PostgreSQL itself.

### Corpus integrity

Status: VERIFIED

| Check                        | Result |
| ---------------------------- | -----: |
| Corpus images                |     43 |
| Completed images             |     43 |
| Metadata rows                |     43 |
| Distinct metadata image IDs  |     43 |
| Metadata orphans             |      0 |
| Embedding rows               |     43 |
| Distinct embedding image IDs |     43 |
| Embedding orphans            |      0 |
| Metadata duplicates          |      0 |
| Embedding duplicates         |      0 |
| Unique corpus filenames      |     43 |

### Test-suite integrity

Status: VERIFIED

The complete Node test suite passes:

```text
tests 89
pass 89
fail 0
cancelled 0
skipped 0
todo 0
```

The database integrity verification confirms that the repository test suite does not pollute the verified corpus state.

## Docker evaluator path

Status: VERIFIED

`capstone.yaml` now declares:

```text
run: docker compose up --build -d
seed: docker compose exec app node scripts/seed-demo.js
base_url: http://localhost:3000
```

The evaluator path was executed locally.

Verification:

```text
Docker Compose:
- application container started
- PostgreSQL container started

GET /health:
status: ok
service: flyrank-capstone-image-relevance

Seed:
- demo image created/reused by filename
- demo post created/reused by title
- image and post IDs remained stable across repeated seed execution

API:
- GET /images returned the seeded image
- GET /posts/:id returned the seeded post
```

The seed generates compatible `gemini-embedding-001` vectors through the configured Gemini embedding provider and upserts them for the seeded image and post.

## AI provider abstraction

Status: VERIFIED

Evidence:
- `VisionProvider`
- `EmbeddingProvider`
- `GeminiVisionProvider`
- `GroqVisionProvider`
- `GeminiEmbeddingProvider`
- Provider contract tests.
- Full test suite: 89/89 passing.

Provider-specific HTTP behavior remains outside the core application services.

## GPL-licensed Wikimedia images

Three sterilizer images (`st-006`, `st-007`, and `st-008`) were identified through the Wikimedia provenance audit with the GNU General Public License (GPL).

The licenses were manually confirmed against the Wikimedia Commons source pages.

The images were excluded from the final corpus because GPL licensing introduces a less straightforward redistribution/source-availability question for photographic assets than the licenses used by the replacement candidates.

Two verified public-domain replacement images were subsequently added.

## Current verification summary

| Requirement                    | Status                                   |
| ------------------------------ | ---------------------------------------- |
| Structured vision output       | VERIFIED                                 |
| Confidence handling            | VERIFIED                                 |
| Batch processing + retries     | VERIFIED                                 |
| Semantic embeddings + matching | VERIFIED                                 |
| Mismatch guard                 | VERIFIED                                 |
| Human-readable rejection       | VERIFIED                                 |
| No-confident-match path        | VERIFIED                                 |
| PostgreSQL persistence         | VERIFIED                                 |
| Review API implementation      | VERIFIED; API-level verification pending |
| Evaluation + Precision@10      | VERIFIED                                 |
| AI cost tracking               | VERIFIED                                 |
| Docker evaluator run path      | VERIFIED                                 |
| Deterministic seed             | VERIFIED                                 |
| Automated tests                | **89/89 PASSING**                        |

Known limitation:
- Guarded precision is **66.67% overall**.
- Patient-monitor guarded precision is **28.57%**.
- The dominant observed failure is high-confidence vision misclassification of hard negatives as patient monitors.