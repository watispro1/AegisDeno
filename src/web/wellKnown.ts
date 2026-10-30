import { REPO_URL } from "./layout";

/** RFC 9116 security.txt. Expires is computed per request, 180 days ahead. */
export function securityTxt(origin: string, now: number = Date.now()): string {
  const expires = new Date(now + 180 * 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  return [
    `Contact: ${REPO_URL}/security/advisories/new`,
    `Expires: ${expires}`,
    "Preferred-Languages: en",
    `Policy: ${REPO_URL}/blob/main/SECURITY.md`,
    ...(origin ? [`Canonical: ${origin}/.well-known/security.txt`] : []),
    "",
  ].join("\n");
}
