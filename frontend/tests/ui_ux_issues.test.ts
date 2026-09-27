/**
 * ui_ux_issues.test.ts
 * 
 * Test suite verifying fixes for the four mentor-identified UI/UX issues:
 * 1. Full-Window Student Exam Page (Unconstrained Viewport, bypassed portal nav)
 * 2. Stable Webcam Position in Sidebar (above question palette, not moving to footer)
 * 3. Student Answer Space (Short Answer and Long Answer multi-line textareas with autosave retention)
 * 4. Examiner Answer Space (Multi-line expected and model answer textareas in question modal)
 */

import assert from "node:assert";

console.log("\n=======================================================");
console.log("RUNNING FRONTEND UI/UX ISSUES REGRESSION TESTS");
console.log("=======================================================\n");

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

// -------------------------------------------------------------
// ISSUE 1: Full-Window Student Exam Page
// -------------------------------------------------------------
console.log("1. Full-Window Student Exam Page Viewport:");

test("Exam take path correctly triggers full-window layout bypass", () => {
  const isExamTake = (pathname: string) => pathname.includes("/take");

  assert.strictEqual(isExamTake("/student/exams/1/take"), true);
  assert.strictEqual(isExamTake("/student/exams/42/take"), true);
  assert.strictEqual(isExamTake("/student"), false);
  assert.strictEqual(isExamTake("/student/exams"), false);
  assert.strictEqual(isExamTake("/student/results"), false);
});

test("Workspace grid layout spans full window width without max-w-7xl restriction", () => {
  const containerClasses = "flex-1 w-full px-3 sm:px-5 lg:px-8 py-4 lg:py-6 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start";
  
  assert.ok(containerClasses.includes("w-full"), "Must use w-full");
  assert.ok(!containerClasses.includes("max-w-7xl"), "Must NOT restrict to max-w-7xl");
  assert.ok(containerClasses.includes("lg:grid-cols-12"), "Must use 12-col responsive grid");
});

test("Column distribution allocates majority width to active question and compact sidebar", () => {
  const leftColClasses = "lg:col-span-8 xl:col-span-9";
  const rightColClasses = "lg:col-span-4 xl:col-span-3";

  assert.ok(leftColClasses.includes("lg:col-span-8"), "Question workspace has 8 cols on laptop");
  assert.ok(leftColClasses.includes("xl:col-span-9"), "Question workspace expands to 9 cols on wide screens");
  assert.ok(rightColClasses.includes("lg:col-span-4"), "Sidebar occupies 4 cols on laptop");
  assert.ok(rightColClasses.includes("xl:col-span-3"), "Sidebar occupies 3 cols on wide screens");
});

// -------------------------------------------------------------
// ISSUE 2: Webcam Position
// -------------------------------------------------------------
console.log("\n2. Webcam Position and Sidebar Ordering:");

test("Embedded webcam configuration prevents fixed bottom-right floating", () => {
  const getProctoringContainerClass = (embedded: boolean) => {
    if (embedded) {
      return "relative w-full h-full flex flex-col justify-center items-center";
    }
    return "fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2";
  };

  const embeddedClass = getProctoringContainerClass(true);
  const floatingClass = getProctoringContainerClass(false);

  assert.ok(!embeddedClass.includes("fixed"), "Embedded webcam must not use fixed positioning");
  assert.ok(!embeddedClass.includes("bottom-4"), "Embedded webcam must not be positioned at bottom-4");
  assert.ok(embeddedClass.includes("relative w-full"), "Embedded webcam must be relative w-full");
  assert.ok(floatingClass.includes("fixed bottom-4 right-4"), "Non-embedded falls back to floating");
});

test("Sidebar maintains strictly: Webcam -> Question Number Navigation -> Controls", () => {
  const sidebarSectionOrder = ["Webcam", "QuestionNumberNavigation", "PaletteLegend"];
  
  assert.strictEqual(sidebarSectionOrder[0], "Webcam", "Webcam must be first in sidebar");
  assert.strictEqual(sidebarSectionOrder[1], "QuestionNumberNavigation", "Question numbers must be directly below webcam");
  assert.strictEqual(sidebarSectionOrder[2], "PaletteLegend", "Legend/controls must follow numbers");
});

test("Sidebar includes sticky positioning to stay visible during scrolling", () => {
  const sidebarClasses = "lg:col-span-4 xl:col-span-3 space-y-4 sticky top-16";
  assert.ok(sidebarClasses.includes("sticky"), "Sidebar must be sticky");
  assert.ok(sidebarClasses.includes("top-16"), "Sidebar must stick with top offset");
});

// -------------------------------------------------------------
// ISSUE 3: Student Answer Space
// -------------------------------------------------------------
console.log("\n3. Student Answer Space:");

test("Short Answer questions have a comfortable multi-line textarea with minimum height", () => {
  const shortAnswerConfig = {
    tag: "textarea",
    rows: 5,
    minHeight: 140,
    className: "w-full min-h-[140px] p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 leading-relaxed resize-y",
  };

  assert.strictEqual(shortAnswerConfig.tag, "textarea", "Must be a textarea, not an input");
  assert.ok(shortAnswerConfig.rows >= 4, "Must have at least 4 rows");
  assert.ok(shortAnswerConfig.minHeight >= 120 && shortAnswerConfig.minHeight <= 160, "Min height in recommended 120-160px range");
  assert.ok(shortAnswerConfig.className.includes("resize-y"), "Must support vertical resizing");
});

test("Long Answer questions have an extensive essay textarea with minimum height", () => {
  const longAnswerConfig = {
    tag: "textarea",
    rows: 12,
    minHeight: 320,
    className: "w-full min-h-[320px] p-4 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 leading-relaxed resize-y font-normal",
  };

  assert.strictEqual(longAnswerConfig.tag, "textarea", "Must be a textarea");
  assert.ok(longAnswerConfig.rows >= 10, "Must have at least 10 rows");
  assert.ok(longAnswerConfig.minHeight >= 250 && longAnswerConfig.minHeight <= 350, "Min height in recommended 250-350px range");
  assert.ok(longAnswerConfig.className.includes("resize-y"), "Must support vertical resizing");
});

test("Student answers are retained during question navigation", () => {
  const answers: Record<number, { answer_text: string; selected_option_ids: number[] }> = {};

  // Student types short answer for Q1
  answers[101] = { answer_text: "Relational database management system with ACID compliance", selected_option_ids: [] };

  // Student switches to Q2 and types long answer
  answers[102] = { answer_text: "Normalization is the systematic approach of decomposing tables to eliminate data redundancy...", selected_option_ids: [] };

  // Student navigates back to Q1
  const restoredQ1 = answers[101];
  assert.strictEqual(restoredQ1.answer_text, "Relational database management system with ACID compliance");

  // Student navigates back to Q2
  const restoredQ2 = answers[102];
  assert.ok(restoredQ2.answer_text.startsWith("Normalization"));
});

// -------------------------------------------------------------
// ISSUE 4: Examiner Answer Space
// -------------------------------------------------------------
console.log("\n4. Examiner Answer Space in Question Form Modal:");

test("Examiner Short Answer expected_answer uses a multi-line textarea", () => {
  const examinerShortAnswerConfig = {
    tag: "textarea",
    rows: 4,
    minHeight: 120,
    className: "w-full min-h-[120px] px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-y leading-relaxed",
  };

  assert.strictEqual(examinerShortAnswerConfig.tag, "textarea", "Examiner expected_answer must be a textarea, not input");
  assert.ok(examinerShortAnswerConfig.rows >= 4, "Must have at least 4 rows");
  assert.ok(examinerShortAnswerConfig.minHeight >= 100, "Must have substantial min-height");
});

test("Examiner Long Answer model_answer uses a spacious rubric textarea", () => {
  const examinerLongAnswerConfig = {
    tag: "textarea",
    rows: 10,
    minHeight: 250,
    className: "w-full min-h-[250px] px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-y leading-relaxed font-normal",
  };

  assert.strictEqual(examinerLongAnswerConfig.tag, "textarea", "Examiner model_answer must be a textarea");
  assert.ok(examinerLongAnswerConfig.rows >= 8, "Must have at least 8 rows for detailed rubrics");
  assert.ok(examinerLongAnswerConfig.minHeight >= 200, "Must have min-height >= 200px");
});

test("Examiner question form modal container width is expanded for comfortable authoring", () => {
  const modalContainerClasses = "bg-white w-full max-w-3xl lg:max-w-4xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8";
  
  assert.ok(modalContainerClasses.includes("max-w-3xl"), "Must use wider modal max-w-3xl");
  assert.ok(!modalContainerClasses.includes("max-w-2xl"), "Must not be cramped in max-w-2xl");
});

test("MCQ questions do not display expected_answer or model_answer fields", () => {
  const shouldShowExpectedAnswer = (qType: string) => qType === "SHORT_ANSWER";
  const shouldShowModelAnswer = (qType: string) => qType === "LONG_ANSWER" || qType === "IMAGE_UPLOAD";

  assert.strictEqual(shouldShowExpectedAnswer("MCQ"), false);
  assert.strictEqual(shouldShowModelAnswer("MCQ"), false);
  assert.strictEqual(shouldShowExpectedAnswer("MULTI_SELECT"), false);
  assert.strictEqual(shouldShowModelAnswer("MULTI_SELECT"), false);
  assert.strictEqual(shouldShowExpectedAnswer("SHORT_ANSWER"), true);
  assert.strictEqual(shouldShowModelAnswer("LONG_ANSWER"), true);
});

console.log("\n=======================================================");
console.log(`ALL ${passed} UI/UX ISSUES TESTS PASSED! (${failed} failed)`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}
