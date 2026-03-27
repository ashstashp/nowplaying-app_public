// src/api/subsonic.ts
import axios from "axios";
import fallback from "../assets/icons/musical-note-outline.svg";

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  durationMs: number,
  progressMs: number,
  isPlaying: boolean
}

export function createSubsonicClient(baseUrl: string) {
  return axios.create({
    baseURL: baseUrl,
    timeout: 5000
  });
}

export async function getNowPlayingSubsonic(
  client: ReturnType<typeof createSubsonicClient>,
  baseUrl: string,
  username: string,
  password: string,
  version: string
): Promise<Track> {
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
      return [];
    }
    const id = response.nowPlaying.entry? response.nowPlaying.entry[0].id : "0";
    const title = response.nowPlaying.entry? response.nowPlaying.entry[0].title : "Not Playing";
    const artist = response.nowPlaying.entry? response.nowPlaying.entry[0].artist : "N/A";
    const album = response.nowPlaying.entry? response.nowPlaying.entry[0].album : "N/A";
    const artworkUrl = response.nowPlaying.entry? getCoverArtUrl(baseUrl, id, username, password, version) : fallback;
    const durationMs = response.nowPlaying.entry? response.nowPlaying.entry[0].duration * 1000 : 0;
    const progressMs = 0;
    const isPlaying = response.nowPlaying.entry? true : false;
    const nowPlaying: Track = {
      id: id, 
      title: title, 
      artist: artist, 
      album: album, 
      artworkUrl: artworkUrl? artworkUrl : fallback, 
      durationMs: durationMs, 
      progressMs: progressMs, 
      isPlaying: isPlaying
    }
    return nowPlaying;
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