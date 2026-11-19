// The buyer's phone number on a deal. Shared so the form's `pattern` and the API accept the same numbers,
// without pulling zod into the browser bundle.

const SEP = String.raw`[\s\(\)\-.]`;

/**
 * 7 to 15 digits, with spaces, dots, dashes or parentheses between them and an optional leading +.
 * Written to work both as an HTML `pattern` (which browsers compile with the `v` flag) and as a plain RegExp.
 */
export const PHONE_PATTERN = String.raw`\+?${SEP}*(?:\d${SEP}*){7,15}`;

const PHONE_RE = new RegExp(`^(?:${PHONE_PATTERN})$`);

export function isPhone(value: string): boolean {
  return PHONE_RE.test(value);
}

/**
 * US numbers (10 digits, or 11 starting with 1) come out as "(801) 555-0142", since the phone keypad
 * has no parentheses or dashes; anything else, like an international number, stays as typed.
 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const us = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : !value.startsWith("+") && digits.length === 10 ? digits : null;
  return us ? `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}` : value;
}

/** For a `tel:` link: the digits, keeping a leading +. */
export function phoneHref(value: string): string {
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}
