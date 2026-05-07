import { generatePKCE } from "../oauth/pkce";
import { writeFile, readFile } from "./storage";
import type { Song, Player, Album, Playlist } from "./subsonic";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export class Spotify implements Player {
  CLIENT_ID = "";
  url = "";
  refresh_token = "";

  notPlaying: Song = {
        "id": "",
        "title": "Not Playing",
        "artist": "N/A",
        "album": "N/A",
        "albumId": "",
        "artworkUrl": "N/A",
        "durationMs": -1,
        "progressMs": 0,
        "isPlaying": false,
        "paused": true
      }
  nowPlaying: Song = this.notPlaying;
  albums: Array<Album> = [];
  playlists: Array<Playlist> = [];
  volume: number = 100;
  queue: Array<string> = [];
  repeat: boolean = false;
  code: any | null = null;
  access_token:string | null = "";
  codeVerifier = "";
  expires_in = 0;

  async asyncTimeout<T>(promise: Promise<T>, time:number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Request Timed Out")), time)
    )
    ]);
  }

  constructor(CLIENT_ID: string) {
    this.CLIENT_ID = CLIENT_ID
    let login = async() => {
      try {
        console.log("Refresh Token Found. Requesting Access Token")
        this.refresh_token = await readFile("spotify_refresh", "client");
      } catch {
        console.log("Error fetching refresh token. Opening with browser.")
      }
      if (this.refresh_token != "") {
        await this.refreshToken();
        setInterval(this.refreshToken, 3600*1000);
      }
      else {
        await this.getSpotifyLoginUrl(this.CLIENT_ID)
        console.log(this.url);
        open(this.url)
        try {
          this.refresh_token = await readFile("refresh_token", "client");
        } catch(e) {}

        listen("spotify-oauth-callback", async (event) => {
          const url = new URL(event.payload as string);
          const code = url.searchParams.get("code");
          this.code = code;
          // console.log(this.code);
          if (code) {
            const tokens = await this.asyncTimeout(this.exchangeCodeForTokens(code, this.CLIENT_ID), 5000)
            this.access_token = tokens.access_token;
            this.refresh_token = tokens.refresh_token;
            this.expires_in = tokens.expires_in;
            console.log(this.access_token);
            console.log(this.refresh_token);
            console.log(this.expires_in);
            await writeFile("spotify_refresh", this.refresh_token, "client");
            setInterval(this.refreshToken, 3600*1000);
          }
        });
      }
    }
    login();
  }

  async getSpotifyLoginUrl(CLIENT_ID: string) {
    const pkce = await generatePKCE();
    // console.log("PKCE: " + pkce);
    await writeFile("spotify_pkce", pkce.codeVerifier, "client");
    this.codeVerifier = await readFile("spotify_pkce", "client");
    // console.log("CODE VERIFIER: " + codeVerifier);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      code_challenge_method: "S256",
      code_challenge: pkce.codeChallenge,
      scope: "user-read-currently-playing user-read-playback-state"
    });

    // console.log("PARAMS: " + params)

    // console.log("URL GENERATED");
    this.url = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, CLIENT_ID: string) {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: this.codeVerifier
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    const tokens = await res.json();
    return tokens;
  }


  // Function adapted from spotify web api documentations:
  // https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens

  async refreshToken() {

   // refresh token that has been previously stored
   const refreshToken = (this.refresh_token != ""? this.refresh_token : await readFile("spotify_refresh", "client"));
   const url = "https://accounts.spotify.com/api/token";

    const payload = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.CLIENT_ID
      }),
    }
    const body = await fetch(url, payload);
    const response = await body.json();

    console.log(response);

    if (!body.ok) {
      throw new Error("Error Refreshing Token: " + response.error);
    }

    console.log("Refresh Successful");
    this.access_token = response.access_token;
    this.expires_in = response.expires_in;
    if (response.refresh_token) {
      this.refresh_token = response.refresh_token;
      await writeFile("spotify_refresh", this.refresh_token, "client");
    }
  }

  ///////////////////////
  ///// Now Playing /////
  ///////////////////////

  async getNowPlayingSpotify(): Promise<Song> {
    if (this.access_token == "") {
      if (this.refresh_token != "") {
        this.refreshToken();
      } else {
        this.exchangeCodeForTokens(this.code, this.CLIENT_ID)
      }
    }

    const res = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: {
          Authorization: `Bearer ${this.access_token}`
        }
      }
    );
    let data;
    if (res.status === 204) {
      data = {id: "0", title: "Not Playing", artist: "N/A", album: "N/A", artworkUrl: "N/A", durationMs: 0, progressMs: -1, isPlaying: false}
    }
    else {
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Spotify error ${res.status}: ${text.slice(0, 100)}`);
      }

      console.log(res);
      try {
        data = await res.json();
      } catch (err) {
        console.log(err);
        data = null;
        return this.notPlaying;
      }
    }

    const id = "0";
    const title = data.item? data.item.name : "Not Playing";
    const artist = data.item? data.item.artists.map((a: any) => a.name).join(", ") : "N/A";
    const album = data.item? data.item.album.name : "N/A";
    const artworkUrl = data.item? data.item.album.images[0].url : "N/A";
    const durationMs = data.item? data.item.duration_ms : 0;
    const progressMs = data.item? data.progress_ms : -1;
    const isPlaying = data.item? data.is_playing : false;
    const nowPlaying: Song = {
      id: id, 
      title: title, 
      artist: artist, 
      album: album,
      albumId: "",
      durationMs: durationMs,
      progressMs: progressMs,
      artworkUrl: artworkUrl,
      isPlaying: isPlaying,
      paused: false
    }

    console.log(nowPlaying);

    return nowPlaying;

    // return {
    //   title: data.item.name,
    //   artist: data.item.artists.map((a: any) => a.name).join(", "),
    //   album: data.item.album.name,
    //   artworkUrl: data.item.album.images[0]?.url ?? "",
    //   durationMs: data.item.duration_ms,
    //   progressMs: data.progress_ms,
    //   isPlaying: data.is_playing
    // };
  }

  loadPlaylists() {};
  loadAlbums() {};
  makeQueue(list: Playlist | Album) {};
  shuffleQueue() {};
  clearQueue() {};
  play(id: string) {};
  pause() {};
  resume() {};
  prevSong() {};
  nextSong() {};
  unload() {};
  seek(time: number) {};
  setVolume(volume: number) {};
  toggleRepeat() {};
}

const REDIRECT_URI = "http://127.0.0.1:1420/callback";

async function open(url: string) {
  await invoke("open_in_browser", { url });
}