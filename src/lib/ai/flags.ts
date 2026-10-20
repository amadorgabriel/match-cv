import "server-only";

/**
 * Enquanto a integração real não for testada com cada provedor, as rotas
 * devolvem dados de exemplo (mock). Para ligar as chamadas reais de IA,
 * defina MATCHCV_ENABLE_AI=true no .env.local.
 */
export function isRealAiEnabled(): boolean {
  return process.env.MATCHCV_ENABLE_AI === "true";
}
