import assert from "node:assert";

console.log("\n=======================================================");
console.log("RUNNING FRONTEND QUESTION IMPORT TESTS (8/8)");
console.log("=======================================================\n");

// 1. Allowed file extension validation
console.log("1. Supported Document File Extensions:");
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt", ".csv", ".xlsx", ".jpg", ".jpeg", ".png"];

function isValidDocumentFile(filename: string): boolean {
  const ext = "." + (filename.split(".").pop() || "").toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

assert.strictEqual(isValidDocumentFile("exam_questions.pdf"), true);
assert.strictEqual(isValidDocumentFile("quiz.docx"), true);
assert.strictEqual(isValidDocumentFile("lecture.pptx"), true);
assert.strictEqual(isValidDocumentFile("questions.csv"), true);
assert.strictEqual(isValidDocumentFile("data.xlsx"), true);
assert.strictEqual(isValidDocumentFile("sample.txt"), true);
assert.strictEqual(isValidDocumentFile("scan.jpg"), true);
assert.strictEqual(isValidDocumentFile("scan.png"), true);
assert.strictEqual(isValidDocumentFile("malicious.exe"), false);
assert.strictEqual(isValidDocumentFile("script.py"), false);
console.log("  [PASS] Allowed document extensions correctly validated");

// 2. File size validation (15 MB maximum)
console.log("\n2. File Size Boundary Check (15MB Limit):");
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

function isFileSizeValid(sizeInBytes: number): boolean {
  return sizeInBytes > 0 && sizeInBytes <= MAX_FILE_SIZE;
}

assert.strictEqual(isFileSizeValid(0), false);
assert.strictEqual(isFileSizeValid(1024), true);
assert.strictEqual(isFileSizeValid(15 * 1024 * 1024), true);
assert.strictEqual(isFileSizeValid(15 * 1024 * 1024 + 1), false);
console.log("  [PASS] File size boundary correctly enforced (15MB max)");

// 3. Selection Toggle Logic
console.log("\n3. Question Selection Toggle Logic:");
const selected = new Set<string>(["temp-1", "temp-2"]);

function toggleSelection(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

const s1 = toggleSelection(selected, "temp-1");
assert.strictEqual(s1.has("temp-1"), false);
assert.strictEqual(s1.has("temp-2"), true);

const s2 = toggleSelection(s1, "temp-3");
assert.strictEqual(s2.has("temp-3"), true);
assert.strictEqual(s2.size, 2);
console.log("  [PASS] Selection toggles individual items cleanly");

// 4. Select All / Deselect All
console.log("\n4. Select All / Deselect All Toggle:");
const allIds = ["temp-1", "temp-2", "temp-3", "temp-4"];

function toggleSelectAll(current: Set<string>, all: string[]): Set<string> {
  if (current.size === all.length) return new Set();
  return new Set(all);
}

const allSelected = toggleSelectAll(new Set(["temp-1"]), allIds);
assert.strictEqual(allSelected.size, 4);

const noneSelected = toggleSelectAll(allSelected, allIds);
assert.strictEqual(noneSelected.size, 0);
console.log("  [PASS] Select All and Deselect All behave symmetrically");

// 5. Skip Duplicates Filter Logic
console.log("\n5. Skip Duplicates Quick Action:");
interface TestExtractedQuestion {
  temp_id: string;
  is_duplicate: boolean;
}

const sampleQuestions: TestExtractedQuestion[] = [
  { temp_id: "q1", is_duplicate: false },
  { temp_id: "q2", is_duplicate: true },
  { temp_id: "q3", is_duplicate: false },
  { temp_id: "q4", is_duplicate: true },
];

function getNonDuplicateIds(questions: TestExtractedQuestion[]): Set<string> {
  return new Set(questions.filter((q) => !q.is_duplicate).map((q) => q.temp_id));
}

const nonDups = getNonDuplicateIds(sampleQuestions);
assert.strictEqual(nonDups.size, 2);
assert.strictEqual(nonDups.has("q1"), true);
assert.strictEqual(nonDups.has("q2"), false);
assert.strictEqual(nonDups.has("q3"), true);
assert.strictEqual(nonDups.has("q4"), false);
console.log("  [PASS] Skip duplicates deselects duplicate items accurately");

// 6. MCQ Correct Option Selection
console.log("\n6. MCQ Radio Option Selection:");
interface TestOption {
  option_text: string;
  is_correct: boolean;
}

function setCorrectOption(options: TestOption[], correctIndex: number): TestOption[] {
  return options.map((opt, idx) => ({
    ...opt,
    is_correct: idx === correctIndex,
  }));
}

const opts: TestOption[] = [
  { option_text: "Alpha", is_correct: false },
  { option_text: "Beta", is_correct: true },
  { option_text: "Gamma", is_correct: false },
];

const updatedOpts = setCorrectOption(opts, 2);
assert.strictEqual(updatedOpts[0].is_correct, false);
assert.strictEqual(updatedOpts[1].is_correct, false);
assert.strictEqual(updatedOpts[2].is_correct, true);
console.log("  [PASS] Setting correct option sets exactly one correct answer");

// 7. Confirmation Payload Assembly
console.log("\n7. Confirmation Payload Assembly:");
function buildConfirmPayload(
  questions: Array<{ temp_id: string; question_text: string; marks: number; subject?: string }>,
  selectedIds: Set<string>,
  defaultSubject: string
) {
  const chosen = questions.filter((q) => selectedIds.has(q.temp_id));
  return {
    questions: chosen.map((q) => ({
      question_text: q.question_text,
      marks: q.marks,
      subject: q.subject || defaultSubject,
    })),
    default_subject: defaultSubject,
  };
}

const payload = buildConfirmPayload(
  [
    { temp_id: "1", question_text: "What is AI?", marks: 2, subject: "AI" },
    { temp_id: "2", question_text: "What is OS?", marks: 3 },
  ],
  new Set(["1", "2"]),
  "Computer Science"
);

assert.strictEqual(payload.questions.length, 2);
assert.strictEqual(payload.questions[0].subject, "AI");
assert.strictEqual(payload.questions[1].subject, "Computer Science");
console.log("  [PASS] Payload correctly assigns specific or default subject");

// 8. Empty Selection Guard
console.log("\n8. Empty Selection Confirmation Guard:");
function validateCanImport(selectedCount: number): { canImport: boolean; error?: string } {
  if (selectedCount === 0) {
    return { canImport: false, error: "Please select at least one question to import." };
  }
  return { canImport: true };
}

assert.strictEqual(validateCanImport(0).canImport, false);
assert.strictEqual(validateCanImport(3).canImport, true);
console.log("  [PASS] Empty selection is blocked with validation error");

console.log("\n=======================================================");
console.log("ALL 8 FRONTEND QUESTION IMPORT TESTS PASSED!");
console.log("=======================================================\n");
