# AI Image Understanding & Content Matching Engine

A backend system that analyzes healthcare-equipment images, generates semantic embeddings, retrieves candidate images for content, and applies a structured mismatch guard before returning suggestions.

Built as the FlyRank Backend Track capstone.

## What problem does this solve?

Content systems often need to select an image that actually matches the subject of a post.

A similarity-only approach can return images that are visually or semantically related but still represent the wrong equipment. This project separates **retrieval** from **validation**:

1. A vision model extracts structured image metadata.
2. An embedding model creates semantic vectors.
3. A matching service ranks candidate images by cosine similarity.
4. A mismatch guard checks subject compatibility, confidence, and similarity.
5. Accepted/rejected suggestions can be sent through a human review workflow.

The system uses a healthcare-equipment content domain with four verified categories:

- `patient_monitor`
- `defibrillator`
- `sterilizer`
- `hospital_bed`

This is a content-matching system, **not a clinical AI system**.

## Architecture

```text
                         ┌─────────────────────┐
                         │      REST API       │
                         │       Express       │
                         └──────────┬──────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
             ▼                      ▼                      ▼
       Image Processing        Post Embedding       Suggestions
             │                      │                      │
             ▼                      ▼                      ▼
       Vision Provider       Embedding Provider     Matching Service
       Gemini / Groq               Gemini                 │
             │                      │                     ▼
             ▼                      ▼               Mismatch Guard
       Structured metadata     Vector embedding           │
             │                      │                     ▼
             └──────────────┬───────┴──────────────► Review
                            │
                            ▼
                       PostgreSQL
```

### Provider abstraction

AI provider-specific API handling is separated behind provider interfaces:

```text
VisionProvider
├── GeminiVisionProvider
└── GroqVisionProvider

EmbeddingProvider
└── GeminiEmbeddingProvider
```

This keeps provider-specific HTTP behavior out of the core application services and leaves room for future providers.

## Core pipeline

### 1. Vision analysis

Each image is analyzed into structured metadata:

```json
{
  "subject": "patient monitor",
  "category": "medical_equipment",
  "attributes": [
    "bedside",
    "vital signs",
    "display"
  ],
  "caption": "A patient monitor displaying vital signs.",
  "confidence": 0.92
}
```

The response is validated against a Zod schema before persistence.

### 2. Embedding generation

The generated image representation is passed to an embedding provider.

The resulting vector is stored with its model and model version.

### 3. Semantic retrieval

For an embedded post, the matching service calculates cosine similarity against successfully embedded image candidates.

Candidates are ranked by similarity and limited to the requested top-K.

### 4. Mismatch guard

Retrieval is not treated as sufficient.

The guard checks:

- vision confidence
- similarity score
- expected subject
- normalized subject aliases

Current thresholds:

- Confidence: `0.70`
- Similarity: `0.65`

The guard can produce:

```text
accepted
rejected
no_confident_match
```

`no_confident_match` is an internal safe rejection path and is not persisted as an accepted/rejected suggestion.

### 5. Human review

Persisted suggestions can be reviewed through the API.

Reviewers can:

- approve a suggestion
- reject a suggestion with a reason
- retrieve a suggestion together with its review state

Duplicate reviews are prevented.

## Background image processing

Image processing runs through a job-based workflow.

A processing job:

1. finds pending images;
2. processes images individually;
3. tracks progress;
4. retries failed image processing;
5. records successful and failed states;
6. logs AI usage and estimated cost.

Job states include:

```text
pending → running → completed
                 ↘ failed
```

Corpus ingestion is idempotent for an image filename. A database-level unique constraint prevents duplicate image records, while repeated processing reuses existing records and skips completed images.

## AI cost logging

Every provider call is logged independently.

AI cost records include:

- operation
- provider
- model
- input tokens
- output tokens
- duration
- estimated cost
- success/failure
- error message
- job association when applicable

Example operations:

```text
vision_analysis
embedding_generation
```

Estimated cost is calculated when usage and provider pricing are available.

This makes AI usage, latency, and failures observable rather than treating model calls as invisible infrastructure.

## Persistence

PostgreSQL stores durable application state for:

- images
- image metadata
- image embeddings
- posts
- post embeddings
- suggestions
- reviews
- processing jobs
- AI cost logs

The database schema is initialized through the migration files mounted into the PostgreSQL Docker container.

## API

### Health

```http
GET /health
```

### Images

```http
POST /images
GET /images
GET /images/:id
```

### Image processing

```http
POST /jobs/image-processing
GET /jobs
GET /jobs/:id
```

### Posts

```http
POST /posts
GET /posts/:id
GET /posts/:id/images
```

### Post embeddings

```http
POST /posts/:postId/embed
```

### Suggestions

```http
POST /posts/:postId/suggestions
GET /suggestions/:id
```

### Reviews

```http
POST /suggestions/:id/approve
POST /suggestions/:id/reject
```

Rejected reviews require a non-empty reason.

## Running locally

### Requirements

- Node.js 22+
- Docker Desktop
- PostgreSQL through Docker
- API keys for the configured AI providers

Install dependencies:

```bash
npm install
```

Create an environment file:

```powershell
Copy-Item .env.example .env
```

Add the required provider credentials to `.env`.

### Start PostgreSQL

```bash
docker compose up -d db
```

PostgreSQL is exposed locally on:

```text
localhost:5433
```

### Start the application

```bash
npm start
```

The API listens on:

```text
http://localhost:3000
```

Health check:

```bash
curl http://localhost:3000/health
```

### Start the full Docker stack

```bash
docker compose up --build
```

The application container connects to PostgreSQL through the Docker network using the `db` service.

## Dataset and corpus

The verified corpus contains **43 images** across four categories.

The corpus was curated using per-image provenance and license verification. Three GPL-licensed sterilizer images were excluded from the final corpus and replaced with verified public-domain candidates.

Final database integrity verification:

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

The evaluation manifest is stored in:

```text
data/evaluation.csv
```

Ground truth distinguishes positive examples, hard negatives, and rejected images. Ground-truth labels come from the dataset manifest rather than from model predictions.

## Evaluation

The project includes a reproducible evaluation runner:

```bash
node scripts/run-evaluation.js
```

The completed evaluation used:

- 12 evaluation posts
- 3 posts per subject
- 4 subject categories
- top-10 retrieval
- positive examples
- hard-negative examples

### Overall results

| Metric | Result |
|---|---:|
| Evaluation posts | 12 |
| Candidates evaluated | 120 |
| Retrieval true positives | 72 |
| Retrieval Precision@10 | **60.00%** |
| Accepted suggestions | 45 |
| Accepted true positives | 30 |
| Accepted false positives | 15 |
| Guarded precision | **66.67%** |

### By subject

| Subject | Retrieval Precision@10 | Guarded Precision |
|---|---:|---:|
| Defibrillator | 80.00% | 100.00% |
| Hospital bed | 40.00% | 100.00% |
| Patient monitor | 20.00% | 28.57% |
| Sterilizer | 100.00% | 100.00% |

### Interpretation

The guard improves precision for three of the four evaluated subjects.

The patient-monitor category is the main weakness. During evaluation, several hard-negative images were themselves classified by the vision model as patient monitors with high confidence. When the structured vision classification is incorrect, the downstream subject guard has limited ability to reject the candidate.

This limitation is reported rather than hidden through aggressive threshold tuning.

The evaluation currently measures **retrieval Precision@10 and guarded precision**. Recall is not reported because not every labeled positive image is necessarily part of the completed candidate set used for this benchmark.

Generated evaluation output is intentionally ignored by Git:

```text
data/evaluation-results.json
data/evaluation_images/
```

## Testing

The project uses Node's built-in test runner.

Run:

```bash
npm test
```

Current verification:

```text
tests 89
pass 89
fail 0
cancelled 0
skipped 0
todo 0
```

The suite covers:

- subject normalization and aliases
- metadata schema validation
- confidence handling
- mismatch guard decisions
- cosine similarity
- repository persistence
- job lifecycle
- retry behavior
- image processing
- post embedding
- AI cost logging
- Gemini embedding provider
- Gemini vision provider
- Groq vision provider
- provider contracts

## Design decisions

### Why structured metadata?

A similarity score alone does not explain whether an image represents the requested subject.

Structured metadata provides explicit signals that can be validated, persisted, and inspected.

### Why separate retrieval from the guard?

Retrieval answers:

> Which images are most similar?

The guard answers:

> Is this candidate sufficiently confident and compatible with the expected subject?

Separating these responsibilities makes errors easier to diagnose and keeps the safety check explicit.

### Why log every AI call?

AI calls introduce external cost, latency, and failure modes.

Per-call logging makes those operational characteristics observable.

### Why use provider interfaces?

Provider-specific HTTP/API behavior should not leak into business logic.

The abstraction allows the core pipeline to remain independent of the selected vision or embedding provider.

### Why use a database uniqueness constraint?

Application-level checks alone are vulnerable to concurrent requests and repeated processing.

The `UNIQUE(filename)` database constraint provides an authoritative identity boundary for corpus images.

## Safety boundary

This is an image/content matching system, not a clinical AI system.

It does **not**:

- diagnose patients;
- interpret clinical images for patient care;
- recommend treatment;
- make patient-care decisions;
- diagnose biomedical equipment faults;
- replace biomedical engineering judgment;
- replace clinical review.

The healthcare-equipment domain is used to demonstrate image understanding, semantic retrieval, workflow handling, validation, and human review.

## Project structure

```text
app/
├── main.js
├── container.js
├── repositories/
│   ├── ai-cost-log-repository.js
│   ├── image-embedding-repository.js
│   ├── image-metadata-repository.js
│   ├── image-repository.js
│   ├── job-repository.js
│   ├── post-embedding-repository.js
│   ├── post-repository.js
│   ├── review-repository.js
│   └── suggestion-repository.js
└── services/
    ├── image-processing-job-service.js
    ├── image-processing-service.js
    ├── matching-service.js
    ├── mismatch-guard-service.js
    ├── post-embedding-service.js
    ├── suggestion-generation-service.js
    └── providers/
        ├── embedding-provider.js
        ├── gemini-embedding-provider.js
        ├── gemini-vision-provider.js
        ├── groq-vision-provider.js
        └── vision-provider.js

migrations/
└── ...

scripts/
├── process-image-corpus.js
└── run-evaluation.js

tests/
└── ...
```

## Current status

The core capstone implementation is complete and verified.

- Real Gemini and Groq AI providers integrated
- Provider abstractions implemented
- PostgreSQL persistence implemented
- Background image processing implemented
- Retry and progress tracking implemented
- AI cost logging implemented
- Semantic retrieval implemented
- Structured mismatch guard implemented
- Human review API implemented
- 43-image corpus verified
- Evaluation dataset and evaluation runner implemented
- 89/89 automated tests passing
- Evaluation completed with 60.00% retrieval Precision@10
- Evaluation completed with 66.67% guarded precision
- Patient-monitor hard-negative weakness documented

The repository's build history and evidence records document the verification decisions and the corrections made during implementation.
