# AI Image Understanding & Content Matching Engine

## 1. Problem

Build a backend service that understands a curated library of healthcare-equipment images and matches suitable images to blog posts based on meaning rather than filenames or exact keywords.

The system must do two things well:

1. Surface a relevant image when the evidence is strong.
2. Refuse the recommendation when the evidence is insufficient or the candidate conflicts with the expected subject.

The core reliability feature is the mismatch guard. A high semantic similarity score alone must not make an image acceptable.

## 2. Goals

- Process a curated corpus of 40–50 healthcare-equipment images.
- Generate structured image metadata using a vision model.
- Validate every vision response against a schema before persistence.
- Flag low-confidence classifications instead of silently accepting them.
- Generate embeddings for image descriptions and blog-post content.
- Rank image candidates by semantic similarity.
- Apply a mismatch guard using subject compatibility, similarity thresholds, and confidence.
- Return a human-readable explanation for accepted or rejected recommendations.
- Return `no confident match` when no candidate clears the acceptance bar.
- Process bulk vision and embedding work through background jobs with retries, progress tracking, and per-call cost tracking.
- Provide API endpoints for retrieving suggestions and reviewing them.
- Measure top-1 precision on a small labeled evaluation set.

## 3. Non-goals

This system does not perform clinical diagnosis, patient-care decision-making, clinical image interpretation, medical-device fault diagnosis, or any other clinical judgment.

The healthcare equipment corpus is used to make the capstone domain-relevant. The system's purpose remains content matching and evidence-based accept/reject decisions.

## 4. Corpus

The initial corpus contains 40–50 manually verified, license-eligible images across four categories:

- `patient_monitor`
- `defibrillator`
- `sterilizer`
- `hospital_bed`

Target distribution: approximately 10–13 images per category.

The category list was selected after manual source verification. Four initially considered categories were dropped because the available search results did not provide enough genuine subject matches: `dialysis_machine`, `ventilator`, `infusion_pump`, and `anesthesia_machine`.

### Corpus quality gate

External search relevance is not treated as ground truth.

Each candidate image must pass:

1. Visual subject verification.
2. Duplicate check.
3. Source URL recording.
4. License/source verification.
5. Corpus metadata recording.

Only then does the image enter the AI ingestion pipeline.

The corpus will include reproducible source records so an evaluator can understand where each image came from.

## 5. Image Metadata Schema

The vision model produces structured metadata:

```json
{
  "subject": "patient monitor",
  "category": "medical_equipment",
  "attributes": [
    "vital signs",
    "display",
    "bedside"
  ],
  "caption": "A patient monitor displaying vital signs in a clinical setting",
  "confidence": 0.94
}
```

### Field responsibilities

| Field | Purpose |
|---|---|
| `subject` | Specific object identity used by the mismatch guard |
| `category` | Broad grouping for the image |
| `attributes` | Additional observable characteristics |
| `caption` | Natural-language representation used for semantic embedding |
| `confidence` | Model confidence from 0–1 |

`subject` is the primary mismatch discriminator.

`category` is intentionally broad: all four initial subjects belong to `medical_equipment`.

A defibrillator subtype such as an AED or clinical crash-cart unit remains an attribute rather than a separate subject because the capstone does not require device-subtype classification.

### Validation

Every model response is validated with Zod.

Invalid output is never trusted or persisted as valid metadata.

Low-confidence output is flagged for review rather than silently accepted.

## 6. Data Model

The persistence layer will separate core entities from generated AI artifacts and review decisions.

### Images

- `id`
- `filename`
- `source_url`
- `license_source`
- `status`
- `created_at`
- `updated_at`

### Image metadata

- `id`
- `image_id`
- `subject`
- `category`
- `attributes`
- `caption`
- `confidence`
- `flagged`
- `model`
- `created_at`

### Image embeddings

- `id`
- `image_id`
- `embedding`
- `model`
- `created_at`

### Posts

- `id`
- `title`
- `content`
- `created_at`
- `updated_at`

### Post embeddings

- `id`
- `post_id`
- `embedding`
- `model`
- `created_at`

### Suggestions

- `id`
- `post_id`
- `image_id`
- `similarity`
- `decision`
- `reason`
- `created_at`

### Reviews

- `id`
- `suggestion_id`
- `decision`
- `reviewer`
- `created_at`

### Jobs

- `id`
- `type`
- `status`
- `attempts`
- `error`
- `progress`
- `started_at`
- `completed_at`

### AI cost logs

- `id`
- `operation`
- `model`
- `input_tokens`
- `output_tokens`
- `estimated_cost`
- `duration_ms`
- `created_at`

Indexes will support image lookup, post lookup, suggestion lookup, job status, and review workflows.

## 7. Matching Strategy

The system uses two embedding streams:

```text
Image
  |
  +--> Vision metadata --> caption --> image embedding
                                      |
                                      |
Blog post --> post embedding ---------+
                                      |
                                      v
                              Similarity ranking
                                      |
                                      v
                              Mismatch guard
```

The image caption and post content are embedded into a shared semantic space.

Candidate images are ranked using cosine similarity.

The system is intended to recognize equivalent concepts rather than depend on exact wording.

Example:

```text
Post:
"How patient monitors support continuous bedside monitoring"

Candidate:
"A vital-signs monitor displaying patient measurements"

The semantic representation can identify the conceptual relationship even when the wording differs.
```

Similarity thresholds will not be chosen purely by intuition. They will be tuned against the labeled evaluation set and documented with the resulting top-1 precision.

## 8. Mismatch Guard

The mismatch guard is the final safety layer before a suggestion is returned.

It combines:

1. Image classification confidence.
2. Semantic similarity.
3. Subject compatibility.

Conceptually:

```text
Candidate
   |
   v
Confidence check
   |
   +-- below threshold --> REJECT
   |
   v
Similarity check
   |
   +-- below threshold --> REJECT
   |
   v
Subject compatibility
   |
   +-- mismatch ---------> REJECT
   |
   v
ACCEPT
```

The guard must produce a human-readable reason for rejection.

### Canonical mismatch case

```text
Post:
"How patient monitors support continuous bedside monitoring"

Candidate:
Defibrillator

Decision:
REJECTED

Reason:
"Subject mismatch: expected patient monitor, detected defibrillator"
```

The patient-monitor/defibrillator case is deliberately useful because both can appear in clinical environments and may share visual characteristics such as displays, cables, and hospital context. The guard therefore has to enforce subject compatibility rather than relying on visual/contextual similarity alone.

### No confident match

If no candidate clears the acceptance bar:

```json
{
  "decision": "no_confident_match",
  "reason": "No candidate satisfied the required similarity, confidence, and subject-compatibility checks."
}
```

The system must not return the highest-ranked image simply because it is the best available candidate.

## 9. Background Processing

Vision processing and embedding generation run as background batch jobs rather than blocking normal API requests.

A job records:

- status
- progress
- attempts
- errors
- start/completion time

AI calls use retries for transient failures.

Repeated processing must be idempotent where the operation requires it.

Every vision and embedding call records its model, token usage where available, duration, and estimated cost.

A budget guard will prevent uncontrolled AI usage.

## 10. API Surface

The API will remain small and focused on the capstone requirements.

### Images

```text
POST /images
GET /images/:id
GET /images
```

### Batch processing

```text
POST /jobs/image-processing
GET /jobs/:id
```

### Posts

```text
POST /posts
GET /posts/:id
```

### Matching

```text
GET /posts/:id/images
```

This endpoint returns ranked candidates after the mismatch guard has evaluated them.

### Review

```text
POST /suggestions/:id/approve
POST /suggestions/:id/reject
GET /suggestions/:id
```

The review response exposes the selected/refused candidate and the reason behind the decision.

## 11. Evaluation Strategy

Create a labeled evaluation set containing at least 10 posts.

Each evaluation post has one manually designated correct image.

For each post:

1. Generate or retrieve the post embedding.
2. Rank image candidates.
3. Apply the mismatch guard.
4. Record the first accepted suggestion, if one exists.
5. Compare it with the labeled correct image.

### Primary metric

**Top-1 precision**

```text
top-1 precision =
posts whose first suggestion is correct
----------------------------------------
total evaluated posts
```

The resulting number will appear in the README and will be reproducible through the evaluation script.

The evaluation set will also include negative/mismatch cases so the guard can be tested separately from ranking quality.

## 12. Failure Handling

The system must fail explicitly rather than silently turning uncertainty into a recommendation.

| Failure | Behavior |
|---|---|
| Invalid vision JSON | Reject response; retry or flag |
| Low vision confidence | Flag image |
| AI call timeout/transient failure | Retry according to job policy |
| Repeated job failure | Mark job failed and retain error |
| Low similarity | Reject candidate |
| Subject mismatch | Reject candidate with explanation |
| No candidate clears threshold | Return `no_confident_match` |
| Duplicate corpus image | Exclude from curated corpus |
| Unverified source/license | Do not ingest into corpus |

## 13. Layered Architecture

The backend will separate:

```text
HTTP/API layer
      |
      v
Application/service layer
      |
      v
Domain/decision logic
      |
      +--> Vision provider
      +--> Embedding provider
      +--> Mismatch guard
      |
      v
Repository/data layer
      |
      v
PostgreSQL
```

The HTTP layer handles request validation and response formatting.

Application services coordinate workflows.

Domain logic contains matching and mismatch decisions.

Repositories handle persistence.

External AI providers sit behind service interfaces so model-specific API details do not leak into the decision logic.

## 14. Phase 1 Gate

Phase 1 is complete when this design document, the database design, matching/guard strategy, and initial corpus plan are committed to the dedicated public repository.

The actual image collection remains a separate Phase 1 task. Each selected image must have its source and license information recorded before ingestion.
