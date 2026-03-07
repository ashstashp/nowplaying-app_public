// src/api/subsonic.ts
import axios from "axios";

export interface SubsonicTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverArt: string;
  duration: number;
}

export function createSubsonicClient(baseUrl: string) {
  return axios.create({
    baseURL: baseUrl,
    timeout: 5000
  });
}

export async function getNowPlayingSubsonic(
  client: ReturnType<typeof createSubsonicClient>,
  username: string,
  password: string,
  version: string
): Promise<SubsonicTrack[] | null> {
  try {
    const res = await client.get("/rest/getNowPlaying", {
      params: {
        u: username,
        p: password,
        v: version,
        c: "NowPlayingApp",
        f: "json"
      }
    });

    const response = res.data["subsonic-response"];
    // console.log(response)

    if (!response.nowPlaying || response.status != "ok") {
      // console.log("Returnning Null (Failed First Check)");
      // console.log(response.nowPlaying);
      return [];
    } else if (!response.nowPlaying.entry) {
      const filler: SubsonicTrack[] = {id: "0", title: "Not Playing", artist: "N/A", album: "N/A", coverArt: "NONE", duration: -1}
      // console.log(`Returning Filler:`);
      // console.log(filler);
      return filler;
    }
    return response.nowPlaying.entry as SubsonicTrack[];
  } catch {
    return null;
  }
}

export function getCoverArtUrl(
  baseUrl: string,
  id: string,
  username: string,
  password: string,
  version: string,
): string {
  return `${baseUrl}/rest/getCoverArt?id=${id}&u=${username}&p=${password}&v=${version}&c=NowPlayingApp`;
}

export function getStreamUrl(baseUrl: string, id: string): string {
  return `${baseUrl}/rest/stream?id=${id}`;
}