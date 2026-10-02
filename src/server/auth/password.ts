import "server-only";
import bcrypt from "bcryptjs";

const COST = 12;

// Compared against when the email is unknown so response time does not reveal which emails exist.
const DUMMY_HASH = "$2b$12$GWEA9YtlDpLSPcbHmwaAoO4nmE/oE09mUV9ZrAqSDzrPOH3Oe/uHu";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(password, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(password, hash);
}
