import assert from "node:assert/strict";
import test from "node:test";

import {
  SUBJECTS,
  normalizeSubject
} from "../../app/domain/constants.js";

test("normalizeSubject handles case differences", () => {
  assert.equal(
    normalizeSubject("Defibrillator"),
    SUBJECTS.DEFIBRILLATOR
  );

  assert.equal(
    normalizeSubject("DEFIBRILLATOR"),
    SUBJECTS.DEFIBRILLATOR
  );

  assert.equal(
    normalizeSubject(" defibrillator "),
    SUBJECTS.DEFIBRILLATOR
  );
});

test("normalizeSubject applies known aliases case-insensitively", () => {
  assert.equal(
    normalizeSubject("Automated External Defibrillator"),
    SUBJECTS.DEFIBRILLATOR
  );

  assert.equal(
    normalizeSubject("Autoclave"),
    SUBJECTS.STERILIZER
  );

  assert.equal(
    normalizeSubject("HOSPITAL BED"),
    SUBJECTS.HOSPITAL_BED
  );
});

test("normalizeSubject preserves unknown subjects", () => {
  assert.equal(
    normalizeSubject("ultrasound machine"),
    "ultrasound machine"
  );
});

test("normalizeSubject preserves non-string values", () => {
  assert.equal(normalizeSubject(null), null);
  assert.equal(normalizeSubject(undefined), undefined);
});
