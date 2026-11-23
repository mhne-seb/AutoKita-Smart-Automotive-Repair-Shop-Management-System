import { randomBytes } from 'node:crypto'
import { passwordProblem } from './passwordPolicy'

export function generatePassword(): string {
    const password = 'Aa1!' + randomBytes(24).toString('base64url')

    if (passwordProblem(password)) {
        throw new Error('Generated password did not meet the password policy.')
    }

    return password
}