/** Mascara uma chave para exibição na UI: "sk-…abcd". */
export function maskKey(key: string): string {
  const k = key.trim();
  if (k.length <= 8) return "…";
  return `${k.slice(0, 3)}…${k.slice(-4)}`;
}
