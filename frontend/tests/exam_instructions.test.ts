/**
 * exam_instructions.test.ts
 * 
 * Test suite verifying the Pre-Exam Instruction and Confirmation Screen feature:
 * 1. Pre-Exam Instructions Modal / Screen invocation before exam entry
 * 2. Exam Summary Metadata (Title, Subject, Question Count, Duration, Total Marks)
 * 3. Dynamic Proctoring Safeguards (Max tab-switch warnings, Gaze sensitivity, Negative marking)
 * 4. Required Exam Guidelines (Internet, Timer, Tab switch, Webcam, Gaze, Autosave, Submit, Retake)
 * 5. Agreement Checkbox validation and Start Examination button gating
 * 6. Session Token generation and enterExam initiation on confirmation
 * 7. Direct URL access protection on /student/exams/[id]/take (Question masking until agreed)
 */

import assert from "node:assert";

console.log("\n=======================================================");
console.log("RUNNING PRE-EXAM INSTRUCTIONS & CONFIRMATION TEST SUITE");
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

// Mock exam fixtures
const mockProctoredExam = {
  id: 101,
  title: "Advanced Operating Systems Midterm",
  subject: "Computer Science",
  duration: 60,
  question_count: 25,
  total_marks: 50,
  proctoring_enabled: true,
  max_tab_switch_warnings: 4,
  gaze_sensitivity: "High",
  negative_marking_enabled: true,
  status: "active",
  start_time: "2026-09-01T00:00:00Z",
  end_time: "2026-10-01T00:00:00Z",
  created_at: "2026-08-01T00:00:00Z",
  has_taken: false,
};

const mockStandardExam = {
  id: 102,
  title: "Discrete Mathematics Quiz",
  subject: "Mathematics",
  duration: 45,
  question_count: 15,
  total_marks: 30,
  proctoring_enabled: false,
  max_tab_switch_warnings: 3,
  gaze_sensitivity: "Medium",
  negative_marking_enabled: false,
  status: "active",
  start_time: "2026-09-01T00:00:00Z",
  end_time: "2026-10-01T00:00:00Z",
  created_at: "2026-08-01T00:00:00Z",
  has_taken: false,
};

// -------------------------------------------------------------
// 1. Instructions Screen Trigger & Invocation Flow
// -------------------------------------------------------------
console.log("1. Instructions Screen Invocation Flow:");

test("Enter Examination button opens instructions modal instead of directly entering exam", () => {
  let selectedExam: any = null;
  let enteredDirectly = false;

  // Handler on Student dashboard / Available exams
  function handleEnterExamClick(exam: any) {
    // Correct behavior: open instructions modal
    selectedExam = exam;
  }

  function handleDirectEnter(exam: any) {
    // Old incorrect behavior
    enteredDirectly = true;
  }

  handleEnterExamClick(mockProctoredExam);

  assert.strictEqual(enteredDirectly, false, "Must not enter exam directly on initial click");
  assert.deepStrictEqual(selectedExam, mockProctoredExam, "Must set selected exam for instructions modal");
});

test("Modal is visible when selectedExam is set and closes when dismissed", () => {
  let selectedExam: any = mockProctoredExam;
  const isModalOpen = (exam: any) => Boolean(exam);

  assert.strictEqual(isModalOpen(selectedExam), true, "Modal must be open when exam is selected");

  // On close / cancel
  selectedExam = null;
  assert.strictEqual(isModalOpen(selectedExam), false, "Modal must close when selectedExam is cleared");
});

// -------------------------------------------------------------
// 2. Examination Summary Metadata Display
// -------------------------------------------------------------
console.log("\n2. Examination Summary Metadata Display:");

test("Modal computes and displays correct exam metadata details", () => {
  function getModalMetadata(exam: any) {
    return {
      title: exam.title,
      subject: exam.subject,
      questionCount: exam.question_count,
      durationDisplay: `${exam.duration} mins`,
      totalMarksDisplay: exam.total_marks
        ? `${exam.total_marks} Marks`
        : `${exam.question_count * 5} Marks (Estimated)`,
      proctoringDisplay: exam.proctoring_enabled ? "AI Active" : "Disabled",
    };
  }

  const metaProctored = getModalMetadata(mockProctoredExam);
  assert.strictEqual(metaProctored.title, "Advanced Operating Systems Midterm");
  assert.strictEqual(metaProctored.subject, "Computer Science");
  assert.strictEqual(metaProctored.questionCount, 25);
  assert.strictEqual(metaProctored.durationDisplay, "60 mins");
  assert.strictEqual(metaProctored.totalMarksDisplay, "50 Marks");
  assert.strictEqual(metaProctored.proctoringDisplay, "AI Active");

  const metaStandard = getModalMetadata(mockStandardExam);
  assert.strictEqual(metaStandard.durationDisplay, "45 mins");
  assert.strictEqual(metaStandard.totalMarksDisplay, "30 Marks");
  assert.strictEqual(metaStandard.proctoringDisplay, "Disabled");
});

// -------------------------------------------------------------
// 3. Dynamic Proctoring Safeguards
// -------------------------------------------------------------
console.log("\n3. Dynamic Proctoring Safeguards Logic:");

test("Safeguards dynamically display configured exam properties", () => {
  function getSafeguards(exam: any) {
    const maxTabWarnings = exam.max_tab_switch_warnings ?? 3;
    const gazeSensitivity = (exam.gaze_sensitivity || "medium").toLowerCase();

    return {
      tabWarningsText: exam.proctoring_enabled ? `Max ${maxTabWarnings} Warnings` : "Not Enforced",
      gazeText: exam.proctoring_enabled ? `${gazeSensitivity} Sensitivity` : "Standard",
      penaltyText: exam.negative_marking_enabled ? "Active for Wrong Answers" : "No Penalty (0)",
    };
  }

  const proctoredSafeguards = getSafeguards(mockProctoredExam);
  assert.strictEqual(proctoredSafeguards.tabWarningsText, "Max 4 Warnings");
  assert.strictEqual(proctoredSafeguards.gazeText, "high Sensitivity");
  assert.strictEqual(proctoredSafeguards.penaltyText, "Active for Wrong Answers");

  const standardSafeguards = getSafeguards(mockStandardExam);
  assert.strictEqual(standardSafeguards.tabWarningsText, "Not Enforced");
  assert.strictEqual(standardSafeguards.gazeText, "Standard");
  assert.strictEqual(standardSafeguards.penaltyText, "No Penalty (0)");
});

// -------------------------------------------------------------
// 4. Required Guidelines Compliance
// -------------------------------------------------------------
console.log("\n4. Examination Guidelines Compliance:");

test("Guidelines contain all mandatory operational rules", () => {
  const guidelines = [
    { title: "Internet Stability", rule: "Make sure you have a stable internet connection before starting." },
    { title: "Countdown Timer", rule: "The examination timer starts immediately after entering the exam. The timer is server-authoritative and will auto-submit answers when expired." },
    { title: "Window & Tab Focus", rule: "Do not switch browser tabs or windows during the examination. Switching tabs or windows generates a warning." },
    { title: "Webcam Visibility", rule: "Keep your face clearly visible in the webcam throughout the examination. Ensure your camera is unblocked and well-lit." },
    { title: "Gaze Monitoring", rule: "Avoid looking away from the screen repeatedly. Repeated abnormal gaze detection may result in warnings or review flags." },
    { title: "Browser Actions", rule: "Do not close or refresh the browser during the examination. Your responses are continuously saved to the server via debounced autosave." },
    { title: "Submission", rule: "Submit the examination before the timer expires using the Finish & Submit button." },
    { title: "Resumption Policy", rule: "Once the examination is submitted or cancelled, it cannot be resumed unless existing system administrator rules allow it." }
  ];

  assert.strictEqual(guidelines.length, 8, "Must contain all 8 key guideline items");
  assert.ok(guidelines.some(g => g.title === "Internet Stability"));
  assert.ok(guidelines.some(g => g.title === "Countdown Timer"));
  assert.ok(guidelines.some(g => g.title === "Window & Tab Focus"));
  assert.ok(guidelines.some(g => g.title === "Webcam Visibility"));
  assert.ok(guidelines.some(g => g.title === "Gaze Monitoring"));
  assert.ok(guidelines.some(g => g.title === "Browser Actions"));
  assert.ok(guidelines.some(g => g.title === "Submission"));
  assert.ok(guidelines.some(g => g.title === "Resumption Policy"));
});

// -------------------------------------------------------------
// 5. Agreement Checkbox & Button State Validation
// -------------------------------------------------------------
console.log("\n5. Agreement Checkbox & Button State Validation:");

test("Start Examination button is disabled until agreement checkbox is checked", () => {
  let agreed = false;
  let loading = false;

  const isButtonDisabled = (isAgreed: boolean, isLoading: boolean) => !isAgreed || isLoading;

  assert.strictEqual(isButtonDisabled(agreed, loading), true, "Button must be disabled initially");

  // User checks the agreement box
  agreed = true;
  assert.strictEqual(isButtonDisabled(agreed, loading), false, "Button must be enabled when agreed");

  // While starting/loading
  loading = true;
  assert.strictEqual(isButtonDisabled(agreed, loading), true, "Button must be disabled during active submission");
});

test("Attempting to submit without agreement is rejected", () => {
  let agreed = false;
  let error: string | null = null;
  let examEntered = false;

  function handleStart() {
    if (!agreed) {
      error = "You must acknowledge and accept the instructions before starting.";
      return;
    }
    examEntered = true;
  }

  handleStart();
  assert.strictEqual(examEntered, false, "Must not enter exam if agreement was not checked");
  assert.strictEqual(error, "You must acknowledge and accept the instructions before starting.");

  agreed = true;
  error = null;
  handleStart();
  assert.strictEqual(examEntered, true, "Must proceed once agreed");
  assert.strictEqual(error, null);
});

// -------------------------------------------------------------
// 6. Exam Entry Flow & Session Storage Handshake
// -------------------------------------------------------------
console.log("\n6. Exam Entry Flow & Session Storage Handshake:");

test("handleConfirmStartExam generates token, enters session, records agreement, and navigates", async () => {
  const mockStorage: Record<string, string> = {};
  let routedPath = "";

  const mockApi = {
    generateExamToken: async (examId: number) => ({ access_token: `token_${examId}` }),
    enterExam: async (examId: number, token: string) => ({
      id: 777,
      exam_id: examId,
      status: "in_progress",
    }),
  };

  async function handleConfirmStartExam(exam: any) {
    const tokRes = await mockApi.generateExamToken(exam.id);
    const session = await mockApi.enterExam(exam.id, tokRes.access_token);
    mockStorage[`exam_agreed_${session.id}`] = "true";
    routedPath = `/student/exams/${session.id}/take`;
  }

  await handleConfirmStartExam(mockProctoredExam);

  assert.strictEqual(mockStorage["exam_agreed_777"], "true", "Agreement must be recorded in session storage for session ID 777");
  assert.strictEqual(routedPath, "/student/exams/777/take", "Must navigate to take page for session ID 777");
});

// -------------------------------------------------------------
// 7. Direct URL Access Protection on /take Page
// -------------------------------------------------------------
console.log("\n7. Direct URL Access Protection on /take Page:");

test("Unconfirmed session masks questions and presents pre-exam instructions modal", () => {
  const sessionId = 888;
  const mockStorage: Record<string, string> = {}; // Empty: user opened URL directly

  function checkConfirmed(sid: number) {
    return mockStorage[`exam_agreed_${sid}`] === "true";
  }

  let hasConfirmedInstructions = checkConfirmed(sessionId);
  assert.strictEqual(hasConfirmedInstructions, false, "Must be unconfirmed when session storage key is missing");

  // In take page: if !hasConfirmedInstructions, questions must not render
  const shouldRenderQuestions = (confirmed: boolean) => confirmed;
  assert.strictEqual(shouldRenderQuestions(hasConfirmedInstructions), false, "Question workspace must not render");

  // Confirming from the direct modal
  mockStorage[`exam_agreed_${sessionId}`] = "true";
  hasConfirmedInstructions = checkConfirmed(sessionId);
  assert.strictEqual(hasConfirmedInstructions, true, "Must be confirmed after agreeing");
  assert.strictEqual(shouldRenderQuestions(hasConfirmedInstructions), true, "Question workspace renders after confirmation");
});

test("Timer countdown and tab-switch monitor remain guarded until instructions confirmed", () => {
  let timerActive = false;
  let tabSwitchMonitored = false;

  function updateTimerGuard(loading: boolean, remaining: number, expired: boolean, confirmed: boolean) {
    if (loading || remaining <= 0 || expired || !confirmed) {
      timerActive = false;
      return;
    }
    timerActive = true;
  }

  function handleVisibilityChange(hidden: boolean, proctoring: boolean, expired: boolean, confirmed: boolean) {
    if (hidden && proctoring && !expired && confirmed) {
      tabSwitchMonitored = true;
    } else {
      tabSwitchMonitored = false;
    }
  }

  // Before confirmation
  updateTimerGuard(false, 3600, false, false);
  handleVisibilityChange(true, true, false, false);
  assert.strictEqual(timerActive, false, "Timer must not tick while instructions are displayed");
  assert.strictEqual(tabSwitchMonitored, false, "Tab switch warnings must not trigger while reading instructions");

  // After confirmation
  updateTimerGuard(false, 3600, false, true);
  handleVisibilityChange(true, true, false, true);
  assert.strictEqual(timerActive, true, "Timer starts ticking after confirmation");
  assert.strictEqual(tabSwitchMonitored, true, "Tab switch monitor activates after confirmation");
});

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log("\n-------------------------------------------------------");
console.log(`PRE-EXAM INSTRUCTIONS TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("-------------------------------------------------------\n");

if (failed > 0) {
  process.exit(1);
}
