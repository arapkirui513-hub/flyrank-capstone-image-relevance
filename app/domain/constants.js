export const GUARD_DECISIONS = {
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  NO_CONFIDENT_MATCH: "no_confident_match"
};

export const REJECTION_REASONS = {
  LOW_CONFIDENCE: "Vision model confidence below minimum threshold.",

  SIMILARITY_BELOW_THRESHOLD:
    "Semantic similarity score is too low.",

  SUBJECT_MISMATCH:
    "Subject mismatch: expected {expected}, detected {detected}.",

  NO_CANDIDATES:
    "No images available in the corpus for this category."
};

export const THRESHOLDS = {
  MIN_CONFIDENCE: 0.70,
  SIMILARITY_THRESHOLD: 0.65
};

export const CATEGORIES = {
  MEDICAL_EQUIPMENT: "medical_equipment"
};

export const SUBJECTS = {
  PATIENT_MONITOR: "patient monitor",
  DEFIBRILLATOR: "defibrillator",
  STERILIZER: "sterilizer",
  HOSPITAL_BED: "hospital bed"
};

/**
 * Canonical subject aliases returned by the vision model.
 *
 * The vision provider can describe the same equipment in different ways.
 * Matching and guard logic should compare canonical subjects rather than
 * raw model wording.
 */
export const SUBJECT_ALIASES = {
  patient_monitor: SUBJECTS.PATIENT_MONITOR,
  "patient monitor": SUBJECTS.PATIENT_MONITOR,
  "fetal_monitor": "fetal monitor",
  "fetal monitor": "fetal monitor",

  defibrillator: SUBJECTS.DEFIBRILLATOR,
  "automated external defibrillator":
    SUBJECTS.DEFIBRILLATOR,
  automated_external_defibrillator:
    SUBJECTS.DEFIBRILLATOR,
  "portable defibrillator":
    SUBJECTS.DEFIBRILLATOR,
  portable_defibrillator:
    SUBJECTS.DEFIBRILLATOR,

  sterilizer: SUBJECTS.STERILIZER,
  autoclave: SUBJECTS.STERILIZER,
  "autoclave sterilizer": SUBJECTS.STERILIZER,
  "benchtop autoclave": SUBJECTS.STERILIZER,
  "dry heat sterilizer": SUBJECTS.STERILIZER,
  "laboratory_autoclave": SUBJECTS.STERILIZER,
  "portable_autoclave": SUBJECTS.STERILIZER,
  "steam_autoclave": SUBJECTS.STERILIZER,
  tabletop_sterilizers: SUBJECTS.STERILIZER,

  hospital_bed: SUBJECTS.HOSPITAL_BED,
  "hospital bed": SUBJECTS.HOSPITAL_BED,
  "adjustable medical bed": SUBJECTS.HOSPITAL_BED,
  "Hill-Rom hospital bed": SUBJECTS.HOSPITAL_BED,

  hospital_stretcher: "hospital stretcher",
  "hospital stretcher": "hospital stretcher",
  "medical stretcher": "hospital stretcher",

  body_bag: "body bag"
};

/**
 * Converts a raw vision-model subject into the canonical subject vocabulary.
 *
 * Unknown subjects remain unchanged so that the guard can reject them
 * rather than silently assigning them to a known equipment class.
 */
export function normalizeSubject(subject) {
  if (typeof subject !== "string") {
    return subject;
  }

  const normalized = subject.trim();

  return SUBJECT_ALIASES[normalized] ?? normalized;
}