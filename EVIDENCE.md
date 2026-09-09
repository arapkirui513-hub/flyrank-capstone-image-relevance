# EVIDENCE

This file contains concrete proof for the capstone requirements.

Evidence must be added as the corresponding functionality is implemented and
verified. Planned functionality is not treated as evidence.

## Phase 1

### Design document

Status: IN PROGRESS

Evidence:
- `docs/design.md`

### Dataset

Status: VERIFIED

Target:
- 40-50 images
- 4 categories

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

Database verification immediately after the full test suite:

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

The corpus contains one database image record per corpus filename and all
43 corpus images are in `completed` status.

## Section 6 Requirements

### 1. Vision structured output + schema validation

Status: VERIFIED

Evidence:
- Vision metadata schema tests pass.
- Gemini vision provider tests pass.
- Image-processing tests verify structured metadata persistence.
- Full test suite: 65/65 passing.

### 2. Low-confidence classification handling

Status: VERIFIED

Evidence:
- Schema validation tests cover confidence values.
- Image-processing tests verify low-confidence metadata handling.
- Full test suite: 65/65 passing.

### 3. Batch processing + retries

Status: IMPLEMENTED AND VERIFIED IN PROCESSING TESTS

Evidence:
- `scripts/process-image-corpus.js`
- Corpus processing supports repeated execution without creating duplicate
  image records.
- Quota/rate-limit errors stop the current run.
- Full test suite passes.
- 43 completed corpus images.
- `UNIQUE(filename)` database constraint verified directly.
- Repeated processing uses existing completed records rather than creating
  duplicates.

### 4. Embeddings and semantic matching

Status: VERIFIED IN UNIT TESTS; REAL-CORPUS VALIDATION PENDING

Evidence:
- Gemini embedding provider implements the embedding contract.
- Image embedding persistence tests pass.
- Matching service tests verify cosine-similarity ranking, limits, missing
  embeddings, dimension mismatch, and zero-magnitude vectors.
- 43 real image embeddings are persisted in PostgreSQL.

Remaining validation:
- Run matching against the 43 real Gemini embeddings.
- Record the observed ranking for the canonical patient-monitor vs.
  defibrillator case.

### 5. Mismatch guard

Status: VERIFIED IN UNIT TESTS; REAL-CORPUS VALIDATION PENDING

Evidence:
- Guard tests cover sufficient similarity, low vision confidence,
  confidence precedence, similarity threshold, null similarity, subject
  mismatch, evaluation order, and exact threshold values.

Remaining validation:
- Execute the guard against rankings generated from the 43 real embeddings.

### 6. Human-readable rejection

Status: VERIFIED IN UNIT TESTS

Evidence:
- Guard result schema supports rejection reasons.
- Rejected suggestion repository tests preserve the rejection reason.
- Full test suite: 65/65 passing.

### 7. No-confident-match behavior

Status: VERIFIED IN UNIT TESTS; REAL-CORPUS VALIDATION PENDING

Evidence:
- Matching/guard tests cover missing or insufficient confidence/similarity
  conditions.
- Full test suite: 65/65 passing.

Remaining validation:
- Confirm behavior using real corpus embeddings and real post embeddings.

### 8. Persistence

Status: VERIFIED

Evidence:
- PostgreSQL repositories persist and retrieve images, metadata, embeddings,
  posts, suggestions, reviews, jobs, and AI cost records.
- Full repository test suite passes.
- Real corpus verification confirms 43 image rows, 43 metadata rows,
  43 embedding rows, 0 orphans, and 0 duplicates.

### 9. Review API

Status: NOT YET VERIFIED

Evidence:
- Repository-level review functionality is tested.
- API-level evidence has not yet been recorded.

### 10. Evaluation dataset and top-1 precision

Status: NOT YET VERIFIED

Evidence:
- The 43-image corpus is verified and available for evaluation.
- Formal top-1 precision evaluation has not yet been run.

### 11. AI cost tracking

Status: VERIFIED IN REPOSITORY TESTS

Evidence:
- AI cost log repository persists successful and failed operations.
- Tests cover retrieval, filtering, deletion, nullable usage/cost on failures,
  and job-reference behavior.
- Full test suite: 65/65 passing.

## Database integrity and ingestion evidence

### Filename uniqueness

Status: VERIFIED

The `images_filename_unique` constraint exists as an active PostgreSQL
database constraint on `images.filename`.

Evidence:
- `migrations/002_image_identity_constraints.sql`
- `scripts/verify-image-constraints.js`

The constraint was checked against PostgreSQL itself rather than relying only
on the migration file.

### Corpus integrity

Status: VERIFIED

Final verified state:

| Check | Result |
|---|---:|
| Corpus images | 43 |
| Completed images | 43 |
| Metadata rows | 43 |
| Distinct metadata image IDs | 43 |
| Metadata orphans | 0 |
| Embedding rows | 43 |
| Distinct embedding image IDs | 43 |
| Embedding orphans | 0 |
| Metadata duplicates | 0 |
| Embedding duplicates | 0 |
| Unique corpus filenames | 43 |

### Test-suite integrity

Status: VERIFIED

The complete Node test suite passes:

```text
tests 65
pass 65
fail 0
cancelled 0
skipped 0
todo 0
```

The database integrity check was run immediately after the test suite and
still reported 43 corpus images, 43 metadata rows, and 43 embedding rows,
with zero orphans and zero duplicates.

This confirms that the repository test suite does not currently pollute the
verified corpus state.

### GPL-licensed Wikimedia images

Three sterilizer images (`st-006`, `st-007`, and `st-008`) were identified
through the Wikimedia provenance audit with the GNU General Public License
(GPL).

The license was manually confirmed against the Wikimedia Commons source
pages. The GPL designation was therefore treated as genuine rather than
corrected to GFDL.

Although the images were validly sourced and their local SHA-256 hashes
matched the recorded values, they were excluded from the final corpus because
GPL licensing introduces a less straightforward redistribution/source-
availability question for photographic assets than the licenses used by the
replacement candidates.

The exclusion is a corpus-curation decision, not a claim that the images were
improperly licensed.
