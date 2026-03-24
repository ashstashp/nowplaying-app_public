<!-- TO DO:
- Auto Login
-->

<script lang="ts">
  console.log("script start");

  // Imports:

  import { platform } from "@tauri-apps/plugin-os";

  import {message} from "@tauri-apps/plugin-dialog";
  import { invoke } from "@tauri-apps/api/core";
  import {
    createSubsonicClient,
    getNowPlayingSubsonic,
    getCoverArtUrl
  } from "../api/subsonic";

  import { readFile, writeFile } from "../api/storage";

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
  import { onMount } from "svelte";


  // import {
  //   initializeKeyring,
  //   setPassword,
  //   getPassword,
  //   deletePassword,
  //   hasPassword,
  //   setSecret,
  //   getSecret,
  //   deleteSecret,
  //   hasSecret
  // } from 'tauri-plugin-keyring'

  ////////////////////////////////////////////////////////////////
  ///////////////////////// Helpful Stuff ////////////////////////
  ////////////////////////////////////////////////////////////////

  const defaultTimeoutTime = 5000;

  async function showError(err: string) {
    await message(err, {title: "Error", kind:"error"})
  }

  async function showWarn(err: string) {
    await message(err, {title: "Warning", kind:"warning"})
  }

  async function asyncTimeout<T>(promise: Promise<T>, time:number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Request Timed Out")), time)
    )
    ]);
  }

  ///////////////////////////////////////////////////////////////
  ///////////////////////// Keyring Info ////////////////////////
  ///////////////////////////////////////////////////////////////
  
  const appId = "com.ashstashp.nowplaying-app";

  const spotifyKeyringId = "spotify-client-id";

  async function addKeyring(userId:string, token: string) {
    try {
    await invoke("store_user_token", {appId, userId, token})
    } catch (err) {
      console.log(err);
      showError(err);
    }
  }

  async function getPassword(userId: string): Promise<string | null> {
    try {
    const response:string = await invoke("get_user_token", {appId, userId})
    return response;
    }
    catch (error) {
      console.error('Failed to get password:', error)
      showError(error);
      return null;
    };
  }

  async function deletePassword(userId: string) {
    try {
      await invoke("delete_user_token", {appId, userId});
    } catch (err) {
      showError(err.message);
    }
  }

  async function getSpotifyClientId() {
    try {
    const userId = spotifyKeyringId;
    CLIENT_ID = await invoke("get_user_token", {appId, userId})
    }
    catch (error) {
      // console.error('Failed to get password:', error)
      showError(error);
      return null;
    };
  }

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
  let subsonicUrl = "";
  let username = "";
  let password = "";
  let version = "1.16.1";
  let imageUrl = fallback;

  /////////////////////////////////////////////////////////////////
  ///////////////////////// Subsonic Stuff ////////////////////////
  /////////////////////////////////////////////////////////////////
  let client = null;

  let nowPlaying = null;

  async function refreshSubsonic() {
      if (autoLogin) {
        writeFile("provider", "subsonic", "client");
      } 

      if (version.trim() == "") {
        version = "1.16.1";
      }
      try {
        const entries = await getNowPlayingSubsonic(client, username, password, version);
        if (entries && entries[0]) {
          nowPlaying = entries[0];
          imageUrl = getCoverArtUrl(subsonicUrl, nowPlaying.coverArt, username, password, version)
        } else if (entries.title == "Not Playing") {
          nowPlaying = entries;
          imageUrl = fallback;
        } else {
          nowPlaying = null;
          loggedIn = false;
          showWarn("Login Failed")
          //selectedProvider = "";
        }
      } catch(err) {
        // if (err.name == "TypeError") {
        //   err = {name: "Input Error", message: "Input empty or invalid"};
        // } 
        nowPlaying = null;
        logout();
        showWarn("Login Failed");
      }
  }

  async function connectSubsonic() {
    loggedIn = true;
    client = createSubsonicClient(subsonicUrl);
    refreshSubsonic();
  }


  ////////////////////////////////////////////////////////////////
  ///////////////////////// Spotify Stuff ////////////////////////
  ////////////////////////////////////////////////////////////////

  let CLIENT_ID = "";

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
      spotifyToken = await asyncTimeout(exchangeCodeForTokens(code, CLIENT_ID), defaultTimeoutTime);
      // console.log(spotifyToken);
    }
  });

  export async function connectSpotify() {

    const url = await getSpotifyLoginUrl(CLIENT_ID);

    await invoke("open_in_browser", { url });
    loggedIn = true;
  }

  async function refreshSpotify() {
    if (autoLogin) {
      writeFile("provider", "spotify", "client");
    } 

    let error = null;
    try {
      const result = await spotifyNowPlaying();
      nowPlaying = result;
      imageUrl = nowPlaying?.artworkUrl
      error = null;
    } catch (err) {
      // Errors come in object data types
      let errorCount = 0;
      const errorLimit = 20;
      error = err;

      // console.log("Err Value")
      // console.log(err);
      // console.log(err.name);
      // console.log(err.message);

      // console.log("\nLINE BREAK\n");

      // console.log("Error Value")
      // console.log(error);
      // console.log(error.name);
      // console.log(error.message);

      // console.log("\nLINE BREAK\n");
      while (errorCount < errorLimit) {
        // Displays Error Count
        // console.log("Error Count: " + errorCount);

        // Checks if error is not a Missing access token error
        if (!error.message.toLowerCase().includes("missing access token")){
          // Informs of non access token error
          // console.log("Non Access Token Error");

          // "Restarts" app
          nowPlaying = null;
          loggedIn = false;
          selectProvider("");

          // Exits loop
          break;
        } 
        // If is Missing access token error
        else {
          // Warns that is access token error
          // console.log("Access token error");
          // console.log("Fetching new token.");

          // Grabs a new access token
          spotifyToken = await exchangeCodeForTokens(globalCode, CLIENT_ID);
          // console.log(spotifyToken);

          // If token is an error, and not invalid_grant error
          if (spotifyToken.error) {
            if (spotifyToken.error != "invalid_grant") {

              // Sets error to the token error
              error = {name: spotifyToken.error, message: spotifyToken.error_description};
              // console.log("Spotify Error:")
              // console.log(error);
            }
          }
        }
        // console.log("error:");
        // console.log(err);
        // console.log("Error Message:")
        // console.log(err.message);
        // console.log("Message type:")
        // console.log(typeof(err.message));
        errorCount++;
      }
      nowPlaying = null;
      loggedIn = false;
      selectProvider("");
      if (errorCount >= errorLimit) {
        error = {name: "error_limit", message: "Error limit reached or Request timed out"}
      }
      showError(error.name + ": " + error.message);
    }
  }

  // refresh stuff

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
  let autoLogin = false;
  const appVersion = "v0.1.7";
  let currentPlatform = "unknown"; 

  async function openLegal() {
    const url = "https://ashstashp.com/legal.html"

    await invoke("open_in_browser", { url });
  }

  
  // Toggle Logout Button Visibility
  function toggleShowLogoutButton() {
    showLogoutButton = !showLogoutButton;
  }

  // Toggle AutoLogin feature
  function toggleAutoLogin() {
    autoLogin = !autoLogin;
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
    autoLogin = false;
    updateSettingsFiles();
  }

  function saveSettings() {
    updateSettingsFiles();
    toggleSettings();
  }

  console.log("Before AutoLogin function def");

  async function runAutoLogin() {
    // Incase of errors cause yk-
    try {
      // Gets provider
      selectedProvider = await readFile("provider", "client")
      // Checks if provider is spotify
      if (selectedProvider == "spotify") {
        // Gets spotify client ID (keyring)
        await getSpotifyClientId();
        // Connects to spotify
        await connectSpotify();
      } 
      // Checks if provider is subsonic
      else if (selectedProvider == "subsonic") {
        // Gets subsonic URL, username, and password (keyrings)
        subsonicUrl = await getPassword("subsonic-server");
        username = await getPassword("subsonic-user");
        password = await getPassword("subsonic-password");
        version = await getPassword("subsonic-version");

        // Connects to subsonic
        setTimeout(connectSubsonic, 3000)
      } else {
        throw Error("INVALID_PROVIDER");
      }
    } catch(err) {
      showError("Auto Login Failed:\n" + err);
      // console.log(selectedProvider);
      selectProvider("");
      loggedIn = false;
    }
  }

  async function updateSettingsFiles() {
    await writeFile("fontSize", fontSize.toString(), "settings");
    await writeFile("artSize", artSize.toString(), "settings");
    await writeFile("showLogoutButton", showLogoutButton.toString(), "settings");
    await writeFile("autoLogin", autoLogin.toString(), "settings");
  }

  async function loadSettingsFiles() {
    fontSize = Number(await readFile("fontSize", "settings"));
    artSize = Number(await readFile("artSize", "settings"));

    const whatShowLogoutButton = await readFile("showLogoutButton", "settings")
    if (whatShowLogoutButton == "true" || whatShowLogoutButton == "truee") {
      showLogoutButton = true;
      // console.log(await readFile("showLogoutButton", "settings") + " == true");
    } else {
      showLogoutButton = false;
      // console.log(await readFile("showLogoutButton", "settings") + " != true");
    };

    const whatAutoLogin = await readFile("autoLogin", "settings")
    if (whatAutoLogin == "true" || whatAutoLogin == "truee") {
      autoLogin = true;
      // console.log(await readFile("autoLogin", "settings") + " == true")
    } else {
      autoLogin = false;
      // console.log(await readFile("autoLogin", "settings") + " != true")
    }
  }

  onMount(async () => {
    try {
      currentPlatform = await platform();
      console.log("Current Platform: " + currentPlatform);
      console.log("Loading Settings Files");
      await loadSettingsFiles();
      console.log(currentPlatform);
      if (autoLogin && (currentPlatform == "windows" || currentPlatform == "macos")) {
        console.log("Running Auto Login");
        await runAutoLogin();
      }
    } catch (err) {
      showError("Failed to load saved settings.\n" + err);
    }
  });

  // Refresh content
  setInterval(refresh, 3000);
  refresh();

  // File Stuff
  // writeFile("TestTextFile", "This is a Text").then(() => readFile("TestTextFile"));

  console.log("script end")
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
    <!-- Quality of Life Features -->
    <div style="display:flex; flex-direction: column;">
      <h1 style="font-size: {fontSize + 16}px">QOL Features:</h1>
      <button class="button" style="font-size: {fontSize}px; display:flex; flex-direction: row; justify-content: space-between;" on:click={toggleAutoLogin}>
        <p style="font-size: {fontSize}px; test-align:left;">Auto Login:</p>
        <p style="font-size: {fontSize}px; color: {currentPlatform == "windows" || currentPlatform == "macos"? autoLogin? "#0f0" : "#f00" : "#f00"};">{currentPlatform == "windows" || currentPlatform == "macos"? autoLogin : "Unavailable"}</p>
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
    <!-- Test Error Popup -->
    <button class="button" style="font-size: {fontSize}px" on:click={() => {showError("Test Error")}}>Test Error Popup</button>
    <!-- Save+Exit Button -->
    <button class="button" style="font-size: {fontSize}px" on:click={saveSettings}>Save and Exit</button>
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
      {#if currentPlatform == "windows" || currentPlatform == "macos"}
        <button class="button" style="font-size: {fontSize}px" on:click={() => {addKeyring(spotifyKeyringId, CLIENT_ID)}}>Save Client ID</button>
        <button class="button" style="font-size: {fontSize}px" on:click={getSpotifyClientId}>Load Client ID</button>
        <button class="button" style="font-size: {fontSize}px; color: #f00;" on:click={() => {deletePassword(spotifyKeyringId)}}>Delete Saved Client ID</button>
      {:else}
        <p class="button" style="font-size:{fontSize}px;">Keyrings are not supported for your OS.</p>
      {/if}
      <button class="button" style="font-size: {fontSize}px" on:click={() => {selectProvider("")}}>Back</button>
    </div>

  <!-- Subsonic Login Page -->
  {:else if selectedProvider == "subsonic"}
    <div class="loginContainer" >
      <form on:submit={connectSubsonic} style="display: flex; flex-direction: column;">
        <input style="font-size: {fontSize}px" bind:value={subsonicUrl} placeholder="Enter your Server URL"/>
        <input style="font-size: {fontSize}px" bind:value={version} placeholder="Enter your Server Version (Default is 1.16.1)"/>
        <input style="font-size: {fontSize}px" bind:value={username} placeholder="Enter your Username"/>
        <input style="font-size: {fontSize}px" type="password" bind:value={password} placeholder="Enter your Password"/>
        <button class="button" style="font-size: {fontSize}px" type="submit">Login</button>
      </form>
      {#if currentPlatform == "windows" || currentPlatform == "macos"}
        <button class="button" style="font-size: {fontSize}px" on:click={() => {
          addKeyring("subsonic-server", subsonicUrl);
          addKeyring("subsonic-user", username);
          addKeyring("subsonic-password", password);
          addKeyring("subsonic-version", version)}}>Save Subsonic Login</button>
        <button class="button" style="font-size: {fontSize}px" on:click={() => {
            getPassword("subsonic-server").then(url => subsonicUrl = url);
            getPassword("subsonic-user").then(user => username = user);
            getPassword("subsonic-password").then(pass => password = pass);
            getPassword("subsonic-version").then(ver => version = ver);
        }}>Load Subsonic Login</button>
        <button class="button" style="font-size: {fontSize}px; color: #f00;" on:click={() => {
          deletePassword("subsonic-server");
          deletePassword("subsonic-user");
          deletePassword("subsonic-password");
          deletePassword("subsonic-version");}}>Delete Subsonic Login
        </button>
      {:else}
        <p class="button" style="font-size:{fontSize}px;">Keyrings are not supported for your OS.</p>
      {/if}
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
