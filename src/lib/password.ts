import bcrypt from 'bcryptjs'

// 10 rounds: slow enough that guessing millions of passwords is expensive,
// fast enough that a normal login doesn't feel it.
const ROUNDS = 10

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS)
}

export async function verifyPassword(plain: string, stored: string | null): Promise<boolean> {
  if (!stored) return false
  // Until the one-time script hashes the old rows, some are still plain text.
  // Every bcrypt hash starts with "$2", so anything else is an old password.
  if (!stored.startsWith('$2')) return plain === stored
  return bcrypt.compare(plain, stored)
}
