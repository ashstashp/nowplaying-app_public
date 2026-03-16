<!-- TO DO:
- Fix Spotify Conection Issues
- Make keyrings/auto-login work 
-->

<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import {
    createSubsonicClient,
    getNowPlayingSubsonic,
    getCoverArtUrl
  } from "../api/subsonic";

  // Fallback Image (Notplaying Icon)
  import fallback from "../assets/icons/musical-note-outline.svg"

  //Spotify Logos
  import spotify_full_black from "../assets/2024-spotify-full-logo/Full_Logo_Black_CMYK.svg";
  import spotify_full_green from "../assets/2024-spotify-full-logo/Full_Logo_Green_CMYK.svg";
  // import spotify_icon_black from "../assets/2024-spotify-logo-icon/Primary_Logo_Black_CMYK.svg";
  // import spotify_icon_green from "../assets/2024-spotify-logo-icon/Primary_Logo_Green_CMYK.svg";

  // Selfhosted (Unofficial Subsonic API) logos
  import selfHosted_icon from "../assets/selfhosted-logos/selfhosted_logo.png";
  import selfHosted_icon_full from "../assets/selfhosted-logos/selfhosted_logo_full_white.png";

  // App Logo
  import logo from "../assets/app-logos/app_logo.svg";
  import logo_full from "../assets/app-logos/app_logo_full.png";

  // Settings Logo
  import settingsIcon_full from "../assets/icons/settings_full.png";
  import settingsIcon from "../assets/icons/settings.png";

  // Logout Icon
  import logoutIcon from "../assets/icons/log-out-outline.svg";

  // Ionicons
  import removeCircle from "../assets/icons/remove-circle.svg";
  import addCircle from "../assets/icons/add-circle.svg";

  import { getSpotifyLoginUrl, exchangeCodeForTokens, getNowPlayingSpotify} from "../api/spotify";
  import { listen } from "@tauri-apps/api/event";
    import { show } from "@tauri-apps/api/app";

  //////////////////////////////////////////////////////////////
  ///////////////////////// Client Info ////////////////////////
  //////////////////////////////////////////////////////////////
  let loggedIn = false;
  let selectedProvider = "";

  function selectProvider(provider: string) {
    selectedProvider = provider;
  }

  function logout() {
    selectProvider("");
    loggedIn = false;
  }

  // Makes the stuff needed
  let baseUrl = "";
  let username = "";
  let password = "";
  let version = "1.16.1";
  let imageUrl = fallback;

  //////////////////////////////////////////////////////////////////
  ///////////////////////// Navidrome Stuff ////////////////////////
  //////////////////////////////////////////////////////////////////
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
      } else if (entries.title == "Not Playing") {
        nowPlaying = entries;
        imageUrl = fallback;
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


  ////////////////////////////////////////////////////////////////
  ///////////////////////// Spotify Stuff ////////////////////////
  ////////////////////////////////////////////////////////////////

  let CLIENT_ID = "";

  let errorCount = 0;

  interface SpotifyToken {
    access_token: string;
    refresh_token?: string;
    expires_at?: number;
  }

  let spotifyToken: SpotifyToken | null = null;

  let globalCode = null;

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
    globalCode = code;

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

  async function refreshSpotify() {
    let error = null;
    try {
      const result = await spotifyNowPlaying();
      nowPlaying = result;
      imageUrl = nowPlaying?.artworkUrl
      error = null;
    } catch (err) {
      // Errors come in object data types
      if (!err.message.includes("Missing access token")){
      console.log("Non Access Token Error")
      nowPlaying = null;
      error = err;
      loggedIn = false;
      selectProvider("");
      } else if (errorCount > 1){
        console.log("Error Limit Reached");
        nowPlaying = null;
        error = err;
        loggedIn = false;
        selectProvider("");
      } else {
        error = null;
        console.log("Access token error");
        console.log("Fetching new token.");
        spotifyToken = await exchangeCodeForTokens(globalCode, CLIENT_ID);
      }
      console.log("error:");
      console.log(err);
      // console.log("Error Message:")
      // console.log(err.message);
      // console.log("Message type:")
      // console.log(typeof(err.message));
      errorCount++;
    }
  }

  async function refresh() {
    if (selectedProvider == "subsonic" && loggedIn) {
      refreshSubsonic();
    } else if (selectedProvider == "spotify" && loggedIn) {
      refreshSpotify();
    }
  }

  /////////////////////////////////////////////////////////////////
  ///////////////////////// Settings Stuff ////////////////////////
  /////////////////////////////////////////////////////////////////
  let artSize = 200;
  let fontSize = 16;
  let showSettings = false;
  let showLogoutButton = true;
  const appVersion = "v0.1.4";

  async function openLegal() {
    const url = "https://ashstashp.com/legal.html"

    await invoke("open_in_browser", { url });
  }

  
  // Toggle settings screen
  function toggleShowLogoutButton() {
    showLogoutButton = !showLogoutButton;
  }

  // Toggle settings screen
  function toggleSettings() {
    showSettings = !showSettings;
  }

  // Increases and Decreases Album Art size (default = 50px)
  function incArtSize() {
    artSize++;
  }

  function decArtSize() {
    artSize--;
  }

  // Increase and decrease font size (default = 16px)
  function incFontSize() {
    fontSize++;
  }

  function decFontSize() {
    if (fontSize - 1 >= 1) fontSize--;
  }

  function restoreDefaults() {
    showLogoutButton = true;
    fontSize = 16;
    artSize = 200;
  }

  // Refresh content
  setInterval(refresh, 3000);
  refresh();

</script>

<main class="container">

<!-------------------------------------------------------->
<!------------------- Settings Screen -------------------->
<!-------------------------------------------------------->
{#snippet settings()}
  <div class="loginContainer">

    <!-- Font/Iocn Size -->
    <h1 style="font-size: {fontSize + 16}px">Font/Icon Size:</h1>
    <div style="display:flex; flex-direction: row; align-items: center; justify-content: center;">
      <button style="background: transparent; border-color: rgba(0, 0, 0, 0);" on:click={decFontSize}>
        <img class="interactiveIcon" style="height:{fontSize + 14}" src={removeCircle} alt="remove-circle icon"/>
      </button>
      <h1 style="font-size: {fontSize + 16}px">{fontSize}px</h1>
      <button style="background: transparent; border-color: rgba(0, 0, 0, 0);" on:click={incFontSize}>
        <img class="interactiveIcon" style="height:{fontSize + 14}" src={addCircle} alt="add-circle icon"/>
      </button>
    </div>

    <!-- Album Art Size -->
    <h1 style="font-size: {fontSize + 16}px">Album Art Size:</h1>
    <div style="display:flex; flex-direction: row; align-items: center; justify-content: center;">
      <button class="interactiveIconBackground" on:click={decArtSize}>
        <img class="interactiveIcon" style="height:{fontSize + 14}" src={removeCircle} alt="remove-circle icon"/>
      </button>
      <h1 style="font-size: {fontSize + 16}px">{artSize}px</h1>
      <button class="interactiveIconBackground" on:click={incArtSize}>
        <img class="interactiveIcon" style="height:{fontSize + 14}" src={addCircle} alt="add-circle icon"/>
      </button>
    </div>
    <!-- Album Art Preview -->
    <div style="display:flex; flex-direction: column; align-items: center; justify-content: center;">
      <h1 style="font-size: {fontSize + 16}px">Album Art Preview:</h1>
      {#if nowPlaying}
        <img class="albumArt" style="width:{artSize}px; height:{artSize}px; border-radius:8px;" src={imageUrl} alt="Preview"/>
      {:else}
        <img class="albumArt" style="width:{artSize}px; height:{artSize}px;" src={fallback} alt="Preview"/>
      {/if}
    </div>

    <!-- Toggle Buttons -->
    <div style="display:flex; flex-direction: column;">
      <h1 style="font-size: {fontSize + 16}px">Button Toggles:</h1>
      <button class="button" style="font-size: {fontSize}px; display:flex; flex-direction: row; justify-content: space-between;" on:click={toggleShowLogoutButton}>
        <p style="font-size: {fontSize}px; test-align:left;">Show Logout Button:</p>
        <p style="font-size: {fontSize}px; color: {showLogoutButton? "#0f0" : "#f00"};">{showLogoutButton}</p>
      </button>
    </div>

    <br>
    <!-- Current App Version -->
    <p style="font-size:{fontSize}px;">Current App Version: {appVersion}</p>

    <!-- Logout Button (if applictable) -->
    {#if loggedIn}
      <button class="button" style="font-size: {fontSize}px; color: #f00;" on:click={logout}><strong>Logout</strong></button>
    {/if}
    <!-- Restore Defaults Button-->
    <button class="button" style="font-size: {fontSize}px" on:click={restoreDefaults}>Restore Defaults</button>
    <!-- Return Button -->
    <button class="button" style="font-size: {fontSize}px" on:click={toggleSettings}>Back</button>
  </div>
{/snippet}

<!---------------------------------------------------------------------------------------------->
<!------------------------------------- Provider Selector -------------------------------------->
<!---------------------------------------------------------------------------------------------->
{#if selectedProvider == "" && !showSettings}
  <div class="loginContainer">
    <!-- Header -->
    <div style="display:flex; flex-direction:row; align-items: center; justify-content: center;">
      <img style="width:auto; height:{fontSize + 40}px" src={logo_full} alt="NowPlayingApp Logo"/>
    </div>

    <!-- Selector -->
    <h1>Select a Provider:</h1>

    <!-- Spotify Button -->
    <button style="background-color: #1ED760; border-color: rgba(0, 0, 0, 0);" class="button" on:click={() => {selectProvider("spotify")}}>
      <img class="spotifyButton" style="height:{fontSize + 40}px" src={spotify_full_black} alt="Spotify Logo"/>
    </button>

    <!-- Subsonic Button -->
    <button style="background-color:#f39c12; border-color: rgba(0, 0, 0, 0);" class="button" on:click={() => {selectProvider("subsonic")}}>
      <img class="selfHostedButton" style="height:{fontSize + 40}px" src={selfHosted_icon_full} alt="selfhosted logo"/>
    </button>

    <!-- Settings Button -->
    <button style="background-color: #000; border-color: rgba(0, 0, 0, 0);" class="button" on:click={toggleSettings}>
      <img class="settingsButton" style="height:{fontSize + 40}px" src={settingsIcon_full} alt="Settings Logo"/>
    </button>

    <!-- Footer -->
    <div style="display:flex; flex-direction:row; align-items: center; justify-content: space-between;">
      <h2>ashstashp™ • 2026</h2>
      <button style="background: transparent; border-color: rgba(0, 0, 0, 0);" on:click={openLegal}><h2>Legal</h2></button>
    </div>
  </div>

{:else if showSettings}
  {@render settings()}

<!----------------------------------------------------------------------------------------->
<!------------------------------------- Login Screen -------------------------------------->
<!----------------------------------------------------------------------------------------->
{:else if loggedIn == false}
  
  <!-- Spotify Login Page -->
  {#if selectedProvider == "spotify"}
    <div class="loginContainer">
      <form on:submit={connectSpotify} style="display: flex; flex-direction: column;">
        <input style="font-size: {fontSize}px" bind:value={CLIENT_ID} placeholder="Enter your Client ID"/>
        <button class="button" style="font-size: {fontSize}px; background-color: #1ED760" type="submit">Login</button>
      </form>
      <button class="button" style="font-size: {fontSize}px" on:click={() => {selectProvider("")}}>Back</button>
    </div>

  <!-- Subsonic Login Page -->
  {:else if selectedProvider == "subsonic"}
    <div class="loginContainer" >
      <form on:submit={logIn} style="display: flex; flex-direction: column;">
        <input style="font-size: {fontSize}px" bind:value={baseUrl} placeholder="Enter your Server URL"/>
        <input style="font-size: {fontSize}px" bind:value={version} placeholder="Enter your Server Version (Default is 1.16.1)"/>
        <input style="font-size: {fontSize}px" bind:value={username} placeholder="Enter your Username"/>
        <input style="font-size: {fontSize}px" type="password" bind:value={password} placeholder="Enter your Password"/>
        <button class="button" style="font-size: {fontSize}px" type="submit">Login</button>
      </form>
      <button class="button" style="font-size: {fontSize}px" on:click={() => {selectProvider("")}}>Back</button>
    </div>
  {/if}

<!----------------------------------------------------------------------------------------------->
<!------------------------------------- Now Playing Screen -------------------------------------->
<!----------------------------------------------------------------------------------------------->
{:else if nowPlaying}
  {#if showSettings}
    {@render settings()}
  {:else if nowPlaying.title != "Not Playing"}
    <div class="backgroundContainer" style="display: flex; flex-direction: row; justify-content:space-between;">
      <!-- Main Content -->
      <div style="display:flex; flex-direction: row;">
        <div style="display: flex; flex-direction: column;">
          {#if selectedProvider == "spotify"}
            <img src={spotify_full_green} alt="Spotify Logo" style="margin: 5px;"/>
          {/if}
          <img class="albumCover" style="height:{artSize}px; width:{artSize}px;" src={imageUrl} alt={`Cover art for ${nowPlaying.title} by ${nowPlaying.artist}`} />
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <h1 style="font-size: {fontSize + 16}px;">{nowPlaying.title}</h1>
          <h2 style="font-size: {fontSize + 8}px;">{nowPlaying.artist}</h2>
        </div>
      </div>

      <!-- Buttons -->
      <div style="display:flex; flex-direction: column; justify-content: space-between;">
        {#if showLogoutButton}
        <button on:click={logout} class="interactiveIconBackground" style="display:flex;"><img class="interactiveIcon" src={logoutIcon} alt="logout button"/></button>
        {:else}
        <button class="interactiveIconBackground" style="display:flex;">{""}</button>
        {/if}
        <button on:click={toggleSettings} class="interactiveIconBackground" style="display:flex;"><img class="interactiveIcon" src={settingsIcon} alt="settings button"/></button>
      </div>
    </div>

  {:else}
    <div class="backgroundContainer" style="display: flex; flex-direction: row; justify-content:space-between;">
      <!-- Main Content -->
      <div style="display:flex; flex-direction: row;">
        <div style="display: flex; flex-direction: column;">
          {#if selectedProvider == "spotify"}
            <img src={spotify_full_green} alt="Spotify Logo" style="margin: 5px;"/>
          {/if}
          <img class="albumCover" style="height:{artSize}px; width:{artSize}px;" src={fallback} alt={`No Music Playing`} />
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <h1 style="font-size: {fontSize + 16}px;">Not Playing</h1>
          <h2 style="font-size: {fontSize + 8}px;">N/A</h2>
        </div>
      </div>

      <!-- Buttons -->
      <div style="display:flex; flex-direction: column; justify-content: space-between;">
        {#if showLogoutButton}
        <button on:click={logout} class="interactiveIconBackground" style="display:flex;"><img class="interactiveIcon" src={logoutIcon} alt="logout button"/></button>
        {:else}
        <button class="interactiveIconBackground" style="display:flex;">{""}</button>
        {/if}
        <button on:click={toggleSettings} class="interactiveIconBackground" style="display:flex;"><img class="interactiveIcon" src={settingsIcon} alt="settings button"/></button>
      </div>
    </div>
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

.settingsButton {
  width: auto;
  height: 50px;
  padding: 20px;
  border-radius: 8px;
}

.interactiveIcon {
  width: auto;
  height: 30px;
}
.interactiveIconBackground {
  background: transparent; 
  border-color: rgba(0, 0, 0, 0);
}

h2 {
  text-align: center;
  color: #fff;
}
h1 {
  text-align: center;
  color: #fff;
}
p {
  text-align: center;
  color: #fff;
}

</style>
