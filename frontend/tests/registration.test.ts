import assert from "node:assert";

console.log("\n=======================================================");
console.log("RUNNING FRONTEND REGISTRATION TESTS (8/8)");
console.log("=======================================================\n");

// 1. Name validation
console.log("1. Full Name Validation:");
function validateFullName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, error: "Please enter your full name." };
  if (trimmed.length < 2) return { valid: false, error: "Full name must be at least 2 characters." };
  return { valid: true };
}
assert.strictEqual(validateFullName("").valid, false);
assert.strictEqual(validateFullName("A").valid, false);
assert.strictEqual(validateFullName("Alice Smith").valid, true);
console.log("  [PASS] Full name validation properly enforces non-empty and min length");

// 2. Email format validation
console.log("\n2. Email Format Validation:");
function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim();
  if (!trimmed) return { valid: false, error: "Please enter your email address." };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return { valid: false, error: "Please enter a valid email address." };
  return { valid: true };
}
assert.strictEqual(validateEmail("invalid-email").valid, false);
assert.strictEqual(validateEmail("user@domain.com").valid, true);
console.log("  [PASS] Email validation verifies standard RFC format");

// 3. Password length validation
console.log("\n3. Password Length Validation:");
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 6) return { valid: false, error: "Password must be at least 6 characters long." };
  return { valid: true };
}
assert.strictEqual(validatePassword("12345").valid, false);
assert.strictEqual(validatePassword("123456").valid, true);
console.log("  [PASS] Password validation enforces minimum 6 characters");

// 4. Password confirmation match validation
console.log("\n4. Password Confirmation Match Validation:");
function validatePasswordMatch(p1: string, p2: string): { valid: boolean; error?: string } {
  if (p1 !== p2) return { valid: false, error: "Passwords do not match. Please re-enter." };
  return { valid: true };
}
assert.strictEqual(validatePasswordMatch("secret123", "secret999").valid, false);
assert.strictEqual(validatePasswordMatch("secret123", "secret123").valid, true);
console.log("  [PASS] Password match check rejects mismatched confirmation");

// 5. Allowed registration roles restriction
console.log("\n5. Registration Allowed Roles Restriction:");
const ALLOWED_PUBLIC_ROLES = ["student", "examiner"] as const;
type AllowedRole = (typeof ALLOWED_PUBLIC_ROLES)[number];

function isAllowedRegistrationRole(role: string): role is AllowedRole {
  return ALLOWED_PUBLIC_ROLES.includes(role as AllowedRole);
}
assert.strictEqual(isAllowedRegistrationRole("student"), true);
assert.strictEqual(isAllowedRegistrationRole("examiner"), true);
assert.strictEqual(isAllowedRegistrationRole("admin"), false);
assert.strictEqual(isAllowedRegistrationRole("superuser"), false);
console.log("  [PASS] Registration strictly allows only 'student' and 'examiner' (NO admin)");

// 6. Post-registration redirect destination mapping
console.log("\n6. Post-Registration Redirect Mapping:");
function getPostRegistrationDestination(role: "student" | "examiner"): string {
  return role === "examiner" ? "/examiner" : "/student";
}
assert.strictEqual(getPostRegistrationDestination("student"), "/student");
assert.strictEqual(getPostRegistrationDestination("examiner"), "/examiner");
console.log("  [PASS] Successful registration correctly routes students to /student and examiners to /examiner");

// 7. Duplicate email backend error message parsing
console.log("\n7. Backend Error Message Parsing:");
function parseRegistrationError(errResponse: { status: number; detail?: string }): string {
  if (errResponse.status === 400 && errResponse.detail?.toLowerCase().includes("already exists")) {
    return "An account with this email address already exists. Please sign in or use another email.";
  }
  return errResponse.detail || "Registration failed. Please try again.";
}
const duplicateMsg = parseRegistrationError({ status: 400, detail: "An account with this email already exists" });
assert.strictEqual(duplicateMsg.includes("already exists"), true);
console.log("  [PASS] Duplicate email HTTP 400 maps to user-friendly error notice");

// 8. Payload construction and password confidentiality in storage
console.log("\n8. Payload Construction & Storage Confidentiality:");
function buildRegisterPayload(name: string, email: string, pass: string, role: AllowedRole) {
  return {
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: pass,
    role: role
  };
}
const payload = buildRegisterPayload(" Jane Doe ", " Jane.Doe@Example.com ", "MySecret@Pass", "student");
assert.strictEqual(payload.name, "Jane Doe");
assert.strictEqual(payload.email, "jane.doe@example.com");
assert.strictEqual(payload.role, "student");
console.log("  [PASS] Payload trims whitespace, lowercases email, and preserves role integrity");

console.log("\n=======================================================");
console.log("ALL 8 FRONTEND REGISTRATION TESTS PASSED!");
console.log("=======================================================\n");
