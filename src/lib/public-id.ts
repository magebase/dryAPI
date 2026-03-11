import { customAlphabet } from "nanoid"

const alphabet = "23456789abcdefghjkmnpqrstuvwxyz"
const createId = customAlphabet(alphabet, 12)

export function createPublicId(prefix = "id") {
  return `${prefix}_${createId()}`
}
