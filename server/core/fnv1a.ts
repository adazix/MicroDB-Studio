// ============================================================================
// MICRODB STUDIO - ALGORITMO HASH FNV-1a (32-bit Little-Endian)
// Idéntico a la implementación de MicroDB_Index.h en Arduino C++
// ============================================================================

export function fnv1a32(str: string | null | undefined): number {
  let hash = 2166136261 >>> 0;
  if (!str) return hash;

  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);

  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    // Multiplicación de 32 bits con desbordamiento sin signo: hash * 16777619
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash;
}
