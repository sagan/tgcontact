export async function sha256(message: string): Promise<string> {
  // 1. Encode the string as a UTF-8 Uint8Array
  const msgUint8 = new TextEncoder().encode(message);

  // 2. Hash the message buffer using the Web Crypto API
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);

  // 3. Convert the ArrayBuffer to a hexadecimal string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
}

export function constantTimeCompare(input: string, secret: string): boolean {
  const encoder = new TextEncoder();
  const inputBytes = encoder.encode(input);
  const secretBytes = encoder.encode(secret);

  // If lengths differ, compare secret to itself to spend the same CPU cycles
  let mismatch = inputBytes.length !== secretBytes.length;
  const compareBytes = mismatch ? secretBytes : inputBytes;

  let result = 0;
  for (let i = 0; i < secretBytes.length; i++) {
    // Bitwise OR accumulates any non-zero differences
    result |= secretBytes[i] ^ compareBytes[i];
  }

  return !mismatch && result === 0;
}
