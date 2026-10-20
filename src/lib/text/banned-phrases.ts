/**
 * Lista inicial de frases e palavras banidas (seção 8 do escopo).
 * Usada nos prompts e no validador. Expanda à vontade.
 */
export const BANNED_PHRASES_PT = [
  "apaixonado por",
  "apaixonada por",
  "paixão por",
  "sinergia",
  "no cenário atual",
  "no mundo atual",
  "em um mundo cada vez mais",
  "mergulhar",
  "mergulho profundo",
  "robusto",
  "robusta",
  "alavancar",
  "agregar valor",
  "fora da caixa",
  "proativo e dinâmico",
  "proativa e dinâmica",
  "jornada",
  "potencializar",
  "desbloquear",
  "elevar",
  "tapeçaria",
  "vale ressaltar",
  "é importante destacar",
  "em suma",
  "em resumo",
  "por fim, mas não menos importante",
  "venho por meio desta",
  "espero que esta mensagem",
  "estou animado com a oportunidade",
  "estou animada com a oportunidade",
  "não apenas",
  "mas também",
] as const;

export const BANNED_PHRASES_EN = [
  "passionate about",
  "leverage",
  "synergy",
  "delve",
  "robust",
  "in today's fast-paced",
  "i am excited to",
  "not only",
  "but also",
  "tapestry",
  "navigate",
] as const;

/** Palavras que só são banidas no sentido figurado. Ficam no prompt, não no regex. */
export const CONTEXTUAL_BANS_PT = [
  "ecossistema (fora do sentido técnico)",
  "navegar (no sentido figurado)",
] as const;

export const ALL_BANNED_PHRASES: readonly string[] = [...BANNED_PHRASES_PT, ...BANNED_PHRASES_EN];
