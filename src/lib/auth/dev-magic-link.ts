const links = new Map<string, { url: string; createdAt: number }>();

/** Guarda o magic link só fora de produção, para o login poder ser testado sem SMTP. */
export function rememberDevMagicLink(email: string, url: string): void {
  if (process.env.NODE_ENV === "production") return;
  links.set(email.trim().toLowerCase(), { url, createdAt: Date.now() });
}

export function readDevMagicLink(email: string): { url: string } | null {
  if (process.env.NODE_ENV === "production") return null;
  const found = links.get(email.trim().toLowerCase());
  if (!found) return null;
  if (Date.now() - found.createdAt > 10 * 60 * 1000) {
    links.delete(email.trim().toLowerCase());
    return null;
  }
  return { url: found.url };
}
