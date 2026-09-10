# BUILDLOG

## Project

AI Image Understanding & Content Matching Engine

## Purpose

This file records how the system was built, including where AI-assisted
development helped, where generated suggestions were incorrect or
insufficient, and what was changed after human review.

## 2026-09-03 � Project initialization

### Decisions established before implementation

- Selected the AI Image Understanding & Content Matching Engine as the active
  FlyRank Backend Track capstone.
- Paused the previously explored Widget/Lead-Capture Platform rather than
  treating it as a second mandatory capstone.
- Selected Node.js + Express.
- Selected Zod for schema validation.
- Selected PostgreSQL for persistence.
- Selected Gemini Flash for vision processing.
- Selected Gemini Embeddings for semantic matching.
- Selected a healthcare-equipment image corpus.
- Final verified corpus categories:
  - patient_monitor
  - defibrillator
  - sterilizer
  - hospital_bed
- Selected `subject` as the primary mismatch discriminator.
- Kept defibrillator subtypes as attributes rather than separate subjects.
- Selected patient-monitor vs. defibrillator as the canonical mismatch case.

### Dataset verification

Initial candidate categories were manually checked rather than accepted from
stock-photo search-result counts.

Results:

| Category | Genuine matches | Decision |
|---|---:|---|
| dialysis_machine | 0 | Drop |
| ventilator | 1 | Drop |
| infusion_pump | 1 | Drop |
| anesthesia_machine | 1 | Drop |
| patient_monitor | 15+ | Keep |
| defibrillator | 10+ | Keep |
| sterilizer | 5 | Keep |
| hospital_bed | 20+ | Keep |

The actual image corpus still needs to be collected and individually
source/license verified.

### Design decisions resolved during design-doc refinement

The following were not part of the original planning discussion and were
resolved while refining `docs/design.md`:

- Suggestions are treated as immutable recommendation records.
- Suggestions carry a `guard_version` so threshold/rule changes create new
  recommendation records rather than silently rewriting historical results.
- Image-processing and embedding operations are idempotent for a given
  image + model + version combination.

These decisions are recorded here separately to preserve decision provenance.

## AI-assisted development log

No implementation AI-assistance entries yet.

Future entries should record:
- Date
- Task
- Where AI helped
- What AI suggested
- What was wrong or incomplete
- Human decision/change
- Verification performed


## 2026-09-09 – Corpus provenance, ingestion, and database integrity

### Corpus provenance audit

The Wikimedia Commons provenance for the healthcare-equipment corpus was
audited per image using the Wikimedia Commons API and source pages.

The audit covered 25 Wikimedia-sourced candidate files.

Three sterilizer images (`st-006`, `st-007`, and `st-008`) were confirmed as
GPL-licensed. Their licenses were manually verified against the corresponding
Wikimedia Commons source pages.

These three images were excluded from the final corpus because GPL licensing
creates a less straightforward redistribution/source-availability situation
for photographic assets than the licenses selected for the replacement images.

Two public-domain replacement images were subsequently sourced and verified.

The final corpus contains 43 images across four categories:

- patient_monitor
- defibrillator
- sterilizer
- hospital_bed

### Ingestion idempotency failure and fix

The initial corpus processor created a new `images` row every time an image
was processed. Repeated runs after Gemini quota errors therefore created
duplicate database records.

During debugging, 43 corpus files resulted in 408 image rows.

The failure was corrected by:

- adding a database-level `UNIQUE(filename)` constraint;
- normalizing corpus paths to forward-slash form;
- changing the corpus processor to find an existing image record before
  creating one;
- skipping images already in `completed` status;
- reusing existing incomplete image records;
- using upsert behavior for image metadata and embeddings.

The database constraint was verified directly through the PostgreSQL
information schema rather than treating the migration file as proof.

### Repository test cleanup failure and fix

Repository tests originally performed cleanup only after successful assertions.
If a test failed before reaching the cleanup statements, its fixture rows
remained in the database.

This produced 17 leaked test-fixture image rows during debugging.

Repository test cleanup was changed to use `try/finally` so database cleanup
runs even when assertions or repository operations fail.

The affected repository tests now clean up their dependent rows before
deleting the associated image rows where required by foreign-key constraints.

### Final corpus integrity verification

After removing the test-fixture noise, the database was verified with the
repository's committed verification scripts.

The verified state is:

- 43 total corpus images
- 43 completed images
- 43 metadata rows
- 43 distinct metadata image IDs
- 0 metadata orphans
- 43 embedding rows
- 43 distinct embedding image IDs
- 0 embedding orphans
- 0 metadata duplicates
- 0 embedding duplicates
- 43 unique corpus filenames

The full Node test suite also passes with 65/65 tests passing.

This verification establishes the current corpus and ingestion state as
reproducible rather than relying on manually reported counts.

## AI-assisted development log

### 2026-09-09 – Ingestion idempotency and test hygiene

- **Task:** Make corpus ingestion repeatable and eliminate database fixture
  leakage.
- **Where AI helped:** Reviewed the ingestion behavior, repository test
  cleanup pattern, database constraints, and verification strategy.
- **What was identified:** The corpus processor could create duplicate image
  rows across repeated runs, and repository tests could leave fixture rows
  behind when assertions failed before cleanup.
- **Human decision/change:** Added database-enforced filename uniqueness,
  find-or-create processing, metadata/embedding upserts, quota/rate-limit
  stopping behavior, and failure-safe test cleanup.
- **Verification performed:** Full test suite passed 65/65. Database checks
  confirmed 43/43/43 images, metadata, and embeddings with zero orphans and
  zero duplicates. The filename uniqueness constraint was also verified
  directly in PostgreSQL.