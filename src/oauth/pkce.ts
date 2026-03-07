export async function generatePKCE() {
  const codeVerifier = [...crypto.getRandomValues(new Uint8Array(64))]
    .map(x => ("0" + x.toString(16)).slice(-2))
    .join("");

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);

  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return { codeVerifier, codeChallenge };
}