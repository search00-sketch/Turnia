// Detecta errores de tipeo frecuentes en el dominio del email ("gmial.com",
// "hotmal.com", "gmail.con"...) para sugerir la corrección antes de crear la
// cuenta: un email mal escrito nunca recibe el mail de confirmación.
const KNOWN_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "hotmail.com.ar",
  "outlook.com",
  "outlook.com.ar",
  "live.com",
  "live.com.ar",
  "yahoo.com",
  "yahoo.com.ar",
  "icloud.com",
];

// Dominios que no existen pero la gente escribe seguido.
const EXPLICIT_FIXES: Record<string, string> = {
  "gmail.com.ar": "gmail.com",
  "gmail.ar": "gmail.com",
  "gmail": "gmail.com",
  "hotmail": "hotmail.com",
  "outlook": "outlook.com",
  "yahoo": "yahoo.com",
};

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        // letras invertidas ("gmial")
        i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? dp[i - 2][j - 2] + 1 : Infinity
      );
    }
  }
  return dp[a.length][b.length];
}

/** Devuelve el email corregido si el dominio parece un error de tipeo, o null si está bien. */
export function suggestEmailFix(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at === trimmed.length - 1) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (KNOWN_DOMAINS.includes(domain)) return null;

  if (EXPLICIT_FIXES[domain]) return `${local}@${EXPLICIT_FIXES[domain]}`;

  let best: { domain: string; distance: number } | null = null;
  for (const known of KNOWN_DOMAINS) {
    const distance = editDistance(domain, known);
    if (distance <= 2 && (!best || distance < best.distance)) best = { domain: known, distance };
  }
  return best ? `${local}@${best.domain}` : null;
}

/** Normaliza el email para guardarlo/usarlo (sin espacios, en minúsculas). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
