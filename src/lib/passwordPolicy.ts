// The one password rule for the whole system: sign-up, reset and "change password".
// Pure code with no server-only imports, so the screens and the API routes share it.

export const PASSWORD_MIN_LENGTH = 8
// bcrypt only uses the first 72 bytes of a password, so longer ones are refused up front.
export const PASSWORD_MAX_LENGTH = 72

/** The rule in one sentence, shown next to every "new password" box. */
export const PASSWORD_RULE_TEXT =
  "Your password must be 8 to 72 characters long and can't be the same as your email address."

/**
 * Returns a short message when the password breaks the rule, or null when it is fine.
 * Pass the account's email when it is known, so the "not your email" rule can be checked.
 */
export function passwordProblem(password: string, email?: string | null): string | null {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`
  }
  if (email && password.toLowerCase() === email.trim().toLowerCase()) {
    return 'Password cannot be your email address.'
  }
  return null
}
