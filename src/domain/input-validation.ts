export const MAX_FULL_NAME_LENGTH = 50;
export const MIN_FULL_NAME_LENGTH = 3;
export const MAX_PHONE_LENGTH = 20;
export const MIN_PHONE_DIGITS = 7;
export const MAX_PHONE_DIGITS = 15;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_UTF8_BYTES = 72;

const HTML_OR_SCRIPT_PATTERN =
  /<[^>]*>|<\s*\/?\s*(script|iframe|object|embed|svg|img|link|style|meta)\b|\b(javascript|vbscript):|data:text\/html|\bon\w+\s*=|\$\{[^}]*\}|\beval\s*\(|\balert\s*\(|\bdocument\.|\bwindow\./i;

const CODE_CHAR_PATTERN = /[<>`{}[\]\\;]/;

const SQL_INJECTION_PATTERN =
  /(--|\/\*|\*\/|;--|['"]\s*(?:or|and)\s+['"]?\w+['"]?\s*=\s*['"]?\w+|\bunion\s+(?:all\s+)?select\b|\b(?:select|insert|update|delete|drop|alter|create|truncate|exec|execute|merge|grant|revoke)\b\s+(?:from|into|table|database|schema|all|set|where|select|\*|\w+\.\w+)|\b(?:sleep|benchmark|waitfor\s+delay|pg_sleep|xp_cmdshell)\s*\()/i;

export function containsCodeOrSqlInjection(value: string): boolean {
  return (
    HTML_OR_SCRIPT_PATTERN.test(value) ||
    CODE_CHAR_PATTERN.test(value) ||
    SQL_INJECTION_PATTERN.test(value)
  );
}

export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function validatePersonName(
  raw: string,
  fieldLabel = "Full name",
  options: { strictAllowlist?: boolean } = { strictAllowlist: true },
): ValidationResult {
  if (raw.length > MAX_FULL_NAME_LENGTH || raw.trim().length > MAX_FULL_NAME_LENGTH) {
    return {
      ok: false,
      error: `${fieldLabel} must be ${MAX_FULL_NAME_LENGTH} characters or fewer.`,
    };
  }

  const normalized = raw.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { ok: false, error: `${fieldLabel} is required.` };
  }

  if (containsCodeOrSqlInjection(raw) || containsCodeOrSqlInjection(normalized)) {
    return {
      ok: false,
      error: `${fieldLabel} contains invalid characters or disallowed code/SQL input.`,
    };
  }

  if (normalized.length < MIN_FULL_NAME_LENGTH) {
    return {
      ok: false,
      error: `${fieldLabel} must be at least ${MIN_FULL_NAME_LENGTH} characters.`,
    };
  }

  const letterCount = (normalized.match(/\p{L}/gu) ?? []).length;
  if (letterCount < MIN_FULL_NAME_LENGTH) {
    return {
      ok: false,
      error: `${fieldLabel} must include at least ${MIN_FULL_NAME_LENGTH} letters and cannot contain only numbers or special characters.`,
    };
  }

  if (options.strictAllowlist !== false) {
    const safeNamePattern = /^[\p{L}][\p{L}\s'.-]*$/u;
    if (!safeNamePattern.test(normalized)) {
      return {
        ok: false,
        error: `${fieldLabel} may only contain letters, spaces, hyphens, apostrophes, and periods.`,
      };
    }
  }

  return { ok: true, value: normalized };
}

export function validatePhoneNumber(raw: string): ValidationResult {
  if (raw.length > MAX_PHONE_LENGTH || raw.trim().length > MAX_PHONE_LENGTH) {
    return {
      ok: false,
      error: `Phone number must be ${MAX_PHONE_LENGTH} characters or fewer.`,
    };
  }

  const normalized = raw.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { ok: false, error: "Phone number is required." };
  }

  if (containsCodeOrSqlInjection(raw)) {
    return {
      ok: false,
      error: "Phone number contains invalid characters.",
    };
  }

  if (!/^[+]?[0-9][0-9 ()-]*$/.test(normalized)) {
    return {
      ok: false,
      error: "Enter a valid phone number using digits, spaces, +, (), or - only.",
    };
  }

  const digits = normalized.replace(/\D/g, "");
  if (digits.length < MIN_PHONE_DIGITS) {
    return {
      ok: false,
      error: `Phone number must include at least ${MIN_PHONE_DIGITS} digits.`,
    };
  }
  if (digits.length > MAX_PHONE_DIGITS) {
    return {
      ok: false,
      error: `Phone number must be ${MAX_PHONE_DIGITS} digits or fewer.`,
    };
  }

  return { ok: true, value: normalized };
}

export function validatePassword(
  raw: string,
  minLength = MIN_PASSWORD_LENGTH,
): ValidationResult {
  if (!raw || raw.trim().length === 0) {
    return {
      ok: false,
      error: "Password cannot be blank or contain only spaces.",
    };
  }
  if (raw.length < minLength || raw.trim().length < minLength) {
    return {
      ok: false,
      error: `Use a password with at least ${minLength} non-space characters.`,
    };
  }
  const utf8Bytes = new TextEncoder().encode(raw).length;
  if (utf8Bytes > MAX_PASSWORD_UTF8_BYTES) {
    return {
      ok: false,
      error: `Password must be at most ${MAX_PASSWORD_UTF8_BYTES} UTF-8 bytes.`,
    };
  }
  return { ok: true, value: raw };
}
