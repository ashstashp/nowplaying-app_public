import { generatePKCE } from "../oauth/pkce";
const REDIRECT_URI = "http://127.0.0.1:1420/callback";

let codeVerifier = "";

export async function getSpotifyLoginUrl(CLIENT_ID: string) {
  const pkce = await generatePKCE();
  codeVerifier = pkce.codeVerifier;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: pkce.codeChallenge,
    scope: "user-read-currently-playing user-read-playback-state"
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, CLIENT_ID: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const tokens = await res.json();
  return tokens;
}

export async function getNowPlayingSpotify(tokens: any) {
  if (!tokens?.access_token) {
    throw new Error("Missing access token");
  }

  const res = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      }
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify error ${res.status}: ${text.slice(0, 100)}`);
  }

  // 204 = no content
  if (res.status === 204) return null;

  const data = await res.json();

  if (!data?.item) return null;

  return {
    title: data.item.name,
    artist: data.item.artists.map((a: any) => a.name).join(", "),
    album: data.item.album.name,
    artworkUrl: data.item.album.images[0]?.url ?? "",
    durationMs: data.item.duration_ms,
    progressMs: data.progress_ms,
    isPlaying: data.is_playing
  };
}