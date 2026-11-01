// The password policy for the whole system: sign-up, reset, and profile password change.
// Pure code with no server-only imports, so screens and API routes share it.

export const PASSWORD_MIN_LENGTH = 8
// bcrypt only uses the first 72 bytes of a password, so longer ones are refused up front.
export const PASSWORD_MAX_LENGTH = 72

export interface PasswordRequirement {
  id: string
  label: string
  met: boolean
}

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  const p = password || ''
  return [
    {
      id: 'length',
      label: 'At least 8 characters',
      met: p.length >= PASSWORD_MIN_LENGTH,
    },
    {
      id: 'uppercase',
      label: 'At least one uppercase letter (A–Z)',
      met: /[A-Z]/.test(p),
    },
    {
      id: 'lowercase',
      label: 'At least one lowercase letter (a–z)',
      met: /[a-z]/.test(p),
    },
    {
      id: 'number',
      label: 'At least one numeric digit (0–9)',
      met: /[0-9]/.test(p),
    },
    {
      id: 'symbol',
      label: 'At least one special symbol (!@#$%^&*)',
      met: /[!@#$%^&*]/.test(p),
    },
  ]
}

/** The rule in one sentence, shown next to every "new password" box. */
export const PASSWORD_RULE_TEXT =
  'At least 8 characters with uppercase, lowercase, number, and special symbol (!@#$%^&*).'

/**
 * Returns a message describing missing requirements when the password breaks the rules,
 * or null when it satisfies all requirements.
 */
export function passwordProblem(password: string, email?: string | null): string | null {
  if (!password) {
    return 'Enter a password.'
  }

  const reqs = getPasswordRequirements(password)
  const unmet = reqs.filter((r) => !r.met)

  if (unmet.length > 0) {
    return `Password is missing: ${unmet.map((r) => r.label).join('; ')}.`
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password cannot be longer than ${PASSWORD_MAX_LENGTH} characters.`
  }

  if (email && password.toLowerCase() === email.trim().toLowerCase()) {
    return 'Password cannot be your email address.'
  }

  return null
}
