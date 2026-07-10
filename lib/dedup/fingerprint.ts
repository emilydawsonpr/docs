import { x86 } from "murmurhash3js";

function tokenize(text: string): string[] {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Word 3-gram shingles (falls back to the whole token list if too short). */
function shingles(text: string, n = 3): string[] {
  const tokens = tokenize(text);
  if (tokens.length <= n) return tokens.length > 0 ? [tokens.join(" ")] : [];
  const result: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    result.push(tokens.slice(i, i + n).join(" "));
  }
  return result;
}

/** Combines two independently-seeded 32-bit Murmur3 hashes into a 64-bit value. */
function hash64(str: string): bigint {
  const high = x86.hash32(str, 0) >>> 0;
  const low = x86.hash32(str, 1) >>> 0;
  return (BigInt(high) << 32n) | BigInt(low);
}

/**
 * 64-bit simhash over word 3-gram shingles, weighted by shingle frequency.
 * Near-duplicate documents (syndicated copies with minor edits) produce
 * fingerprints with a small Hamming distance.
 */
export function simhash64(text: string): bigint {
  const weights = new Array<number>(64).fill(0);
  const grams = shingles(text);
  if (grams.length === 0) return 0n;

  const freq = new Map<string, number>();
  for (const gram of grams) freq.set(gram, (freq.get(gram) ?? 0) + 1);

  for (const [gram, count] of freq) {
    const h = hash64(gram);
    for (let bit = 0; bit < 64; bit++) {
      const mask = 1n << BigInt(bit);
      weights[bit] += (h & mask) !== 0n ? count : -count;
    }
  }

  let fingerprint = 0n;
  for (let bit = 0; bit < 64; bit++) {
    if (weights[bit] > 0) fingerprint |= 1n << BigInt(bit);
  }
  return fingerprint;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

export function fingerprintToHex(fp: bigint): string {
  return fp.toString(16).padStart(16, "0");
}

export function hexToFingerprint(hex: string): bigint {
  return BigInt(`0x${hex}`);
}
