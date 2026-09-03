# BUILDLOG

## Project

AI Image Understanding & Content Matching Engine

## Purpose

This file records how the system was built, including where AI-assisted
development helped, where generated suggestions were incorrect or
insufficient, and what was changed after human review.

## 2026-09-03 – Project initialization

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
