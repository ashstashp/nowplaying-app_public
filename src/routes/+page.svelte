<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import {
    createSubsonicClient,
    getNowPlayingSubsonic,
    getCoverArtUrl
  } from "../api/subsonic";

  import fallback from "../assets/musical-note-outline.svg"
  import spotify_full_black from "../assets/2024-spotify-full-logo/Full_Logo_Black_CMYK.svg";
  import spotify_full_green from "../assets/2024-spotify-full-logo/Full_Logo_Green_CMYK.svg";
  import spotify_icon_black from "../assets/2024-spotify-logo-icon/Primary_Logo_Black_CMYK.svg";
  import spotify_icon_green from "../assets/2024-spotify-logo-icon/Primary_Logo_Green_CMYK.svg";
  import selfHosted_icon from "../assets/selfhosted_logo.svg";
  import logo from "../assets/app_logo.svg";

  import { getSpotifyLoginUrl, exchangeCodeForTokens, getNowPlayingSpotify} from "../api/spotify";
  import { listen } from "@tauri-apps/api/event";

  // Login and Client logic (Server -> Navidrome or Spotify. baseURL stays the same)
  let loggedIn = false;
  let selectedProvider = "";

  function selectProvider(provider) {
    selectedProvider = provider;
  }

  // Makes the stuff needed
  let baseUrl = "";
  let username = "";
  let password = "";
  let version = "1.16.1";
  let imageUrl = fallback;


  // Navidrome Stuff
  let client = null;

  let nowPlaying = null;

  async function refreshSubsonic() {
      if (version.trim() == "") {
        version = "1.16.1";
      }
      const entries = await getNowPlayingSubsonic(client, username, password, version);
      if (entries && entries[0]) {
        nowPlaying = entries[0];
        imageUrl = getCoverArtUrl(baseUrl, nowPlaying.coverArt, username, password, version)
      } else if (entries.duration == -1) {
        nowPlaying = entries;
      } else {
        nowPlaying = null;
        loggedIn = false;
        //selectedProvider = "";
      }
  }

  function logIn() {
    loggedIn = true;
    client = createSubsonicClient(baseUrl);
    refreshSubsonic();
  }


  // Spotify stuff

  let CLIENT_ID = "";

  interface SpotifyToken {
    access_token: string;
    refresh_token?: string;
    expires_at?: number;
  }

  let spotifyToken: SpotifyToken | null = null;

  export function setSpotifySession(token: SpotifyToken) {
    spotifyToken = token;
    // console.log(spotifyToken);
  }

  async function spotifyNowPlaying() {
    return await getNowPlayingSpotify(spotifyToken);
  }


  listen("spotify-oauth-callback", async (event) => {
    const url = new URL(event.payload as string);
    const code = url.searchParams.get("code");

    if (code) {
      spotifyToken = await exchangeCodeForTokens(code, CLIENT_ID);
      // console.log(spotifyToken);
    }
  });

  export async function connectSpotify() {
    const url = await getSpotifyLoginUrl(CLIENT_ID);

    await invoke("open_in_browser", { url });
    loggedIn = true;
  }

  async function openLegal() {
    const url = "https://ashstashp.com/legal.html"

    await invoke("open_in_browser", { url });
  }

  async function refreshSpotify() {
    let error = null;
    try {
      const result = await spotifyNowPlaying();
      nowPlaying = result;
      imageUrl = nowPlaying?.artworkUrl
      error = null;
    } catch (err) {
      nowPlaying = null;
      error = err;
      // console.log("error:")
      // console.log(err)
    }

    if (error != null) {
      loggedIn = false;
      selectProvider("");
    }
  }

  async function refresh() {
    if (selectedProvider == "subsonic" && loggedIn) {
      refreshSubsonic();
    } else if (selectedProvider == "spotify" && loggedIn) {
      refreshSpotify();
    }
  }

  setInterval(refresh, 3000);
  refresh();

</script>

<main class="container">
{#if selectedProvider == ""}
  <div class="loginContainer">
    <!-- Header -->
    <div style="display:flex; flex-direction:row; align-items: center; justify-content: center;">
      <img style="width:50px; height:50px"src={logo} alt="NowPlayingApp Logo"/>
      <h1>NowPlaying App</h1>
    </div>

    <!-- Selector -->
    <h1>Select a Provider:</h1>
    <button style="background-color: #1ED760; border-color: rgba(0, 0, 0, 0);" class="button" on:click={() => {selectProvider("spotify")}}>
    <img class="spotifyButton" src={spotify_full_black} alt="Spotify Logo"/>
    </button>
    <button style="display:flex; flex-direction: row; align-items: center; justify-content: center; background-color:#f39c12; border-color: rgba(0, 0, 0, 0);" class="button" on:click={() => {selectProvider("subsonic")}}>
    <img class="selfHostedButton" src={selfHosted_icon} alt="selfhosted logo"/> <h1>Subsonic API (Navidrome, Airsonic, etc.)</h1>
    </button>

    <!-- Footer -->
    <div style="display:flex; flex-direction:row; align-items: center; justify-content: space-between;">
      <h2>ashstashp™ • 2026</h2>
      <button style="background: transparent; border-color: rgba(0, 0, 0, 0);" on:click={openLegal}><h2>Legal</h2></button>
    </div>
  </div>
{:else}

  {#if loggedIn == false} 
    {#if selectedProvider == "spotify"}
    <!-- Spotify Login Page -->
    <div class="loginContainer">
      <form on:submit={connectSpotify} style="display: flex; flex-direction: column;">
        <input bind:value={CLIENT_ID} placeholder="Enter your Client ID"/>
        <button class="button" style="background-color: #1ED760" type="submit">Login</button>
      </form>
      <button class="button" on:click={() => {selectProvider("")}}>Back</button>
    </div>
    {:else}
    <!-- Subsonic Login page -->
    <div class="loginContainer" >
      <form on:submit={logIn} style="display: flex; flex-direction: column;">
        <input bind:value={baseUrl} placeholder="Enter your Server URL"/>
        <input bind:value={version} placeholder="Enter your Server Version (Default is 1.16.1)"/>
        <input bind:value={username} placeholder="Enter your Username"/>
        <input type="password" bind:value={password} placeholder="Enter your Password"/>
        <button class="button" type="submit">Login</button>
      </form>
      <button class="button" on:click={() => {selectProvider("")}}>Back</button>
    </div>
    {/if}
  {:else}

    {#if nowPlaying}
      <div class="backgroundContainer" style="display: flex; flex-direction: row;">
        <div style="display: flex; flex-direction: column;">
          {#if selectedProvider == "spotify"}
          <img src={spotify_full_green} alt="Spotify Logo" style="margin: 5px;"/>
          {/if}
          <img class="albumCover" src={imageUrl} alt={`Cover art for ${nowPlaying.title} by ${nowPlaying.artist}`} />
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <h1>{nowPlaying.title}</h1>
          <h2>{nowPlaying.artist}</h2>
        </div>
      </div>
    {:else}

      <div class="backgroundContainer" style="display: flex; flex-direction: row;">
        <img class="albumCover" src={imageUrl} alt={`No Song Playing`} />
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <h1>Not Playing</h1>
          <h2>N/A</h2>
        </div>
      </div>
    {/if}

  {/if}

{/if}
</main>

<style>
:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

main {
  background: transparent;
}

.backgroundContainer {
  background-color: rgba(0, 0, 0, 0.5);
  padding: 9px;
  border-radius: 10px;
}

.container {
  margin: 0;
  padding-top: 10vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}

.loginContainer {
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
}

.albumCover {
  width: 200px;
  height: 200px;
  border-radius: 8px;
  color: #fff;
  margin-right: 10px;
}

input {
  margin: 5px;
  color: #fff;
  background-color: #000;
  border-radius: 8px;
  padding: 5px;
  border-color: rgba(0, 0, 0, 0);
}

.button {
  margin: 5px;
  color: #fff;
  background-color: #000;
  border-radius: 8px;
  padding: 5px;
  border-color: rgba(0, 0, 0, 0);
}

.spotifyButton {
  width: auto;
  height: 50px;
  padding: 20px;
  background-color: #1ED760;
  border-radius: 8px;
}

.selfHostedButton {
  width: auto;
  height: 50px;
  padding: 20px;
  border-radius: 8px;
}

h2 {
  text-align: center;
  color: #fff;
}
h1 {
  text-align: center;
  color: #fff;
}

</style>
