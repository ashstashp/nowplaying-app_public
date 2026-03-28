<!-- TO DO:
- Start NowPlaying+ (Allows for playback controls and streaming)
-->

<script lang="ts">

  // Imports:

  import { platform } from "@tauri-apps/plugin-os";

  import {message} from "@tauri-apps/plugin-dialog";
  import { invoke } from "@tauri-apps/api/core";
  import { createSubsonicClient, getNowPlayingSubsonic, type Track } from "../api/subsonic";

  import { readFile, writeFile } from "../api/storage";

  //Spotify Logos
  import spotify_full_black from "../assets/2024-spotify-full-logo/Full_Logo_Black_CMYK.svg";
  import spotify_full_green from "../assets/2024-spotify-full-logo/Full_Logo_Green_CMYK.svg";

  // Selfhosted (Unofficial Subsonic API) logos
  import selfHosted_icon from "../assets/selfhosted-logos/selfhosted_logo.png";
  import selfHosted_icon_full from "../assets/selfhosted-logos/selfhosted_logo_full_white.png";

  // App Logo
  import logo from "../assets/app-logos/app_logo.svg";
  import logo_full from "../assets/app-logos/app_logo_full.png";

  // Settings Logo
  import settingsIcon_full from "../assets/icons/settings_full.png";

  import { getSpotifyLoginUrl, exchangeCodeForTokens, getNowPlayingSpotify} from "../api/spotify";
  import { listen } from "@tauri-apps/api/event";
  import { onMount } from "svelte";

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
  let imageUrl = "N/A";

  /////////////////////////////////////////////////////////////////
  ///////////////////////// Subsonic Stuff ////////////////////////
  /////////////////////////////////////////////////////////////////
  let client = null;

  let nowPlaying: Track = {id: "0", title: "Not Playing", artist: "N/A", album: "N/A", artworkUrl: "N/A", durationMs: 0, progressMs: -1, isPlaying: false};

  let progressMs = 0;

  function resetTimer() {
    progressMs = 0;
  }

  async function refreshSubsonic() {
      if (autoLogin) {
        writeFile("provider", "subsonic", "client");
      } 

      if (version.trim() == "") {
        version = "1.16.1";
      }
      try {
        let tempPlaying = await getNowPlayingSubsonic(client, subsonicUrl, username, password, version);
        if (!nowPlaying || tempPlaying.id !== nowPlaying.id) {
          resetTimer();
          nowPlaying = tempPlaying;
        }
        if (nowPlaying) {
          imageUrl = nowPlaying.artworkUrl
          if (nowPlaying.isPlaying) {
            progressMs += 2000;
            nowPlaying.progressMs = progressMs;
          }
        }
        else {
          nowPlaying = {id: "0", title: "Not Playing", artist: "N/A", album: "N/A", artworkUrl: "N/A", durationMs: 0, progressMs: -1, isPlaying: false};
          logout();
          showWarn("Login Failed")
        }
      } catch(err) {
        nowPlaying = {id: "0", title: "Not Playing", artist: "N/A", album: "N/A", artworkUrl: "N/A", durationMs: 0, progressMs: -1, isPlaying: false};
        logout();
        console.log(err)
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

      while (errorCount < errorLimit) {
        // Displays Error Count

        // Checks if error is not a Missing access token error
        if (!error.message.toLowerCase().includes("missing access token")){
          // "Restarts" app
          nowPlaying = null;
          logout()

          // Exits loop
          break;
        } 
        // If is Missing access token error
        else {
          // Grabs a new access token
          spotifyToken = await exchangeCodeForTokens(globalCode, CLIENT_ID);

          // If token is an error, and not invalid_grant error
          if (spotifyToken.error && spotifyToken.error != "invalid_grant") {
            // Sets error to the token error
            error = {name: spotifyToken.error, message: spotifyToken.error_description};
          }
        }
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

  ///////////////////////////////////////////////////////////
  ///////////////////////// UI Stuff ////////////////////////
  ///////////////////////////////////////////////////////////

  let mainColor = [0, 0, 0];
  let fontColor = [255, 255, 255];
  let secondaryColor = [0, 0, 0, 0.5];

  let mainColorStr = "rgb(0, 0, 0)";
  let fontColorStr = "rgb(255, 255, 255)";
  let secondaryColorStr = "rgba(0, 0, 0, 0.5)";

  function updateColors() {
    mainColorStr = "rgb(" + mainColor[0] + ", " + mainColor[1] + ", " + mainColor[2] + ")";
    fontColorStr = "rgb(" + fontColor[0] + ", " + fontColor[1] + ", " + fontColor[2] + ")";
    secondaryColorStr = "rgba(" + secondaryColor[0] + ", " + secondaryColor[1] + ", " + secondaryColor[2] + ", " + secondaryColor[3] + ")";
    document.documentElement.style.setProperty("--main-color", mainColorStr);
    document.documentElement.style.setProperty("--secondary-color", secondaryColorStr);
    document.documentElement.style.setProperty("--font-color", fontColorStr);
    saveColors();
  }

  async function saveColors() {
    await writeFile("mainColor-0", mainColor[0].toString(), "theme");
    await writeFile("mainColor-1", mainColor[1].toString(), "theme");
    await writeFile("mainColor-2", mainColor[2].toString(), "theme");
    await writeFile("secondaryColor-0", secondaryColor[0].toString(), "theme");
    await writeFile("secondaryColor-1", secondaryColor[1].toString(), "theme");
    await writeFile("secondaryColor-2", secondaryColor[2].toString(), "theme");
    await writeFile("secondaryColor-3", secondaryColor[3].toString(), "theme");
    await writeFile("fontColor-0", fontColor[0].toString(), "theme");
    await writeFile("fontColor-1", fontColor[1].toString(), "theme");
    await writeFile("fontColor-2", fontColor[2].toString(), "theme");
  }

  async function loadColors() {
    mainColor[0] = Number(await readFile("mainColor-0", "theme"));
    mainColor[1] = Number(await readFile("mainColor-1", "theme"));
    mainColor[2] = Number(await readFile("mainColor-2", "theme"));
    secondaryColor[0] = Number(await readFile("secondaryColor-0", "theme"));
    secondaryColor[1] = Number(await readFile("secondaryColor-1", "theme"));
    secondaryColor[2] = Number(await readFile("secondaryColor-2", "theme"));
    secondaryColor[3] = Number(await readFile("secondaryColor-3", "theme"));
    fontColor[0] = Number(await readFile("fontColor-0", "theme"));
    fontColor[1] = Number(await readFile("fontColor-1", "theme"));
    fontColor[2] = Number(await readFile("fontColor-2", "theme"));
    updateColors();
  }

  onMount(async () => {
    try {
      await loadColors();
    } catch (err) {
      showError("Failed to load saved theme.\n" + err);
    }
  });

  /////////////////////////////////////////////////////////////////
  ///////////////////////// Settings Stuff ////////////////////////
  /////////////////////////////////////////////////////////////////
  let artSize = 200;
  let fontSize = 16;
  let showSettings = false;
  let showLogoutButton = true;
  let autoLogin = false;
  let displayProgress = true;
  const appVersion = "v0.8.1";
  let currentPlatform = "unknown"; 

  async function openLegal() {
    const url = "https://ashstashp.com/legal.html"

    await invoke("open_in_browser", { url });
  }

  
  // Toggle Logout Button Visibility
  function toggleShowLogoutButton() {
    showLogoutButton = !showLogoutButton;
  }

  function toggleDisplayProgress() {
    displayProgress = !displayProgress;
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

  function discardSettings() {
    loadSettingsFiles();
    toggleSettings();
  }

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
        await connectSubsonic();
      } else {
        throw Error("INVALID_PROVIDER");
      }
    } catch(err) {
      showError("Auto Login Failed:\n" + err);
      logout();
    }
  }

  async function updateSettingsFiles() {
    await writeFile("fontSize", fontSize.toString(), "settings");
    await writeFile("artSize", artSize.toString(), "settings");
    await writeFile("showLogoutButton", showLogoutButton.toString(), "settings");
    await writeFile("autoLogin", autoLogin.toString(), "settings");
    await writeFile("displayProgress", displayProgress.toString(), "settings");
  }

  async function loadSettingsFiles() {
    fontSize = Number(await readFile("fontSize", "settings"));
    artSize = Number(await readFile("artSize", "settings"));

    const whatShowLogoutButton = await readFile("showLogoutButton", "settings")
    if (whatShowLogoutButton == "true" || whatShowLogoutButton == "truee") {
      showLogoutButton = true;
    } else {
      showLogoutButton = false;
    };

    const whatAutoLogin = await readFile("autoLogin", "settings")
    if (whatAutoLogin == "true" || whatAutoLogin == "truee") {
      autoLogin = true;
    } else {
      autoLogin = false;
    }

    const whatDisplayProgress = await readFile("displayProgress", "settings")
    if (whatDisplayProgress == "true" || whatAutoLogin == "truee") {
      displayProgress = true;
    } else {
      displayProgress = false;
    }
  }

  onMount(async () => {
    try {
      currentPlatform = await platform();
      await loadSettingsFiles();
      if (autoLogin && (currentPlatform == "windows" || currentPlatform == "macos")) {
        await runAutoLogin();
      }
    } catch (err) {
      showError("Failed to load saved settings.\n" + err);
    }
  });

  ///////////////////////////////////////////////////////////////
  ///////////////////////// Progress Bar ////////////////////////
  ///////////////////////////////////////////////////////////////

  // refresh stuff
  async function refresh() {
    if (selectedProvider == "subsonic" && loggedIn) {
      refreshSubsonic();
    } else if (selectedProvider == "spotify" && loggedIn) {
      refreshSpotify();
    }
  }

  // Refresh content
  setInterval(refresh, 2000);
  refresh();
</script>

<main class="container">
<script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></script>
<script nomodule src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"></script>

<!-------------------------------------------------------->
<!------------------- Settings Screen -------------------->
<!-------------------------------------------------------->
{#snippet settings()}
  <div class="loginContainer">

    <!-- Font/Iocn Size -->
    <h1 style="font-size: {fontSize + 16}px">Font/Icon Size:</h1>
    <div style="display:flex; flex-direction: row; align-items: center; justify-content: center;">
      <button style="background: transparent; border-color: rgba(0, 0, 0, 0);" on:click={decFontSize} title="decrease-font-size">
        <ion-icon style="color:{fontColorStr}; font-size:{fontSize+14}px" size={fontSize+30} name="remove-circle"></ion-icon>
      </button>
      <h1 style="font-size: {fontSize + 16}px">{fontSize}px</h1>
      <button style="background: transparent; border-color: rgba(0, 0, 0, 0);" on:click={incFontSize} title="increase-font-size">
        <ion-icon style="color:{fontColorStr}; font-size:{fontSize+14}px" name="add-circle"></ion-icon>
      </button>
    </div>

    <!-- Theme Settings -->
    <h1 style="font-size: {fontSize + 16}px">Theme Settings</h1>
    <div style="display:flex; flex-direction: column; align-items: center; justify-content: center;">
      <form on:submit={updateColors} style="display: flex; flex-direction: column;">
        <h2 style="font-size: {fontSize + 8}px">Main Color (RGB)</h2>
        <div style="display:flex; flex-direction: row; align-items: center; justify-content: center;">
          <input style="font-size: {fontSize}px" bind:value={mainColor[0]} placeholder="Enter RED Value"/>
          <input style="font-size: {fontSize}px" bind:value={mainColor[1]} placeholder="Enter GREEN Value"/>
          <input style="font-size: {fontSize}px" bind:value={mainColor[2]} placeholder="Enter BLUE Value"/>
        </div>
        <h2 style="font-size: {fontSize + 8}px">Secondary Color (RGB)</h2>
        <div style="display:flex; flex-direction: row; align-items: center; justify-content: center;">
          <input style="font-size: {fontSize}px" bind:value={secondaryColor[0]} placeholder="Enter RED Value"/>
          <input style="font-size: {fontSize}px" bind:value={secondaryColor[1]} placeholder="Enter GREEN Value"/>
          <input style="font-size: {fontSize}px" bind:value={secondaryColor[2]} placeholder="Enter BLUE Value"/>
        </div>
        <h2 style="font-size: {fontSize + 8}px">Background Transparency (0-1)</h2>
        <div style="display:flex; flex-direction: row; align-items: center; justify-content: center;">
          <input style="font-size: {fontSize}px" bind:value={secondaryColor[3]} placeholder="Enter ALPHA Value"/>
        </div>
        <h2 style="font-size: {fontSize + 8}px">Font Color (RGB)</h2>
        <div style="display:flex; flex-direction: row; align-items: center; justify-content: center;">
          <input style="font-size: {fontSize}px" bind:value={fontColor[0]} placeholder="Enter RED Value"/>
          <input style="font-size: {fontSize}px" bind:value={fontColor[1]} placeholder="Enter GREEN Value"/>
          <input style="font-size: {fontSize}px" bind:value={fontColor[2]} placeholder="Enter BLUE Value"/>
        </div>
        <button class="button" style="font-size: {fontSize}px;" type="submit">Save</button>
      </form>
    </div>

    <!-- Album Art Size -->
    <h1 style="font-size: {fontSize + 16}px">Album Art Size:</h1>
    <div style="display:flex; flex-direction: row; align-items: center; justify-content: center;">
      <button class="interactiveIconBackground" on:click={decArtSize} title="decrease-art-size">
        <ion-icon style="color:{fontColorStr}; font-size:{fontSize+14}px" name="remove-circle"></ion-icon>
      </button>
      <h1 style="font-size: {fontSize + 16}px">{artSize}px</h1>   
      <button class="interactiveIconBackground" on:click={incArtSize} title="increase-art-size">
        <ion-icon style="color:{fontColorStr}; font-size:{fontSize+14}px" name="add-circle"></ion-icon>
      </button>
    </div>

    <!-- Album Art Preview -->
    <div style="display:flex; flex-direction: column; align-items: center; justify-content: center;">
      <h1 style="font-size: {fontSize + 16}px">Album Art Preview:</h1>
      {#if selectedProvider == "spotify"}
        <img src={spotify_full_green} alt="Spotify Logo" style="margin: 5px; width: {artSize}px; height: auto;"/>
      {/if}
      {#if nowPlaying.isPlaying == true}
      <img class="albumArt" style="width:{artSize}px; height:{artSize}px; border-radius:8px;" src={imageUrl} alt="Preview"/>
      {:else}
      <ion-icon name="musical-note-outline" style="font-size:{artSize}px; color:{fontColorStr}"></ion-icon>
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
      <button class="button" style="font-size: {fontSize}px; display:flex; flex-direction: row; justify-content: space-between;" on:click={toggleDisplayProgress}>
        <p style="font-size: {fontSize}px; test-align:left;">Display Progress Bar:</p>
        <p style="font-size: {fontSize}px; color: {displayProgress? "#0f0" : "#f00"};">{displayProgress}</p>
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
    <button class="button" style="font-size: {fontSize}px; color: #f00;" on:click={discardSettings}>Discard Changes</button>
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
{:else}
  {#if showSettings}
    {@render settings()}
  <!-- {:else if nowPlaying.isPlaying == true} -->
   {:else}
  <div class="backgroundContainer" style="display: flex; flex-direction: column; justify-content:center;">
    <div style="display: flex; flex-direction: row; justify-content:space-between;">
      <!-- Main Content -->
      <div style="display:flex; flex-direction: row;">
        <div style="display: flex; flex-direction: column;">
          {#if selectedProvider == "spotify"}
            <img src={spotify_full_green} alt="Spotify Logo" style="margin: 5px;"/>
          {/if}
          {#if nowPlaying.isPlaying == true}
          <img class="albumCover" style="height:{artSize}px; width:{artSize}px;" src={imageUrl} alt={`Cover art for ${nowPlaying.title} by ${nowPlaying.artist}`} />
          {:else}
          <ion-icon name="musical-note-outline" style="font-size:{artSize}px; color:{fontColorStr}"></ion-icon>
          {/if}
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <h1 style="font-size: {fontSize + 16}px;">{nowPlaying.title}</h1>
          <h2 style="font-size: {fontSize + 8}px;">{nowPlaying.artist}</h2>
        </div>
      </div>

      <!-- Buttons -->
      <div style="display:flex; flex-direction: column; justify-content: space-between;">
        {#if showLogoutButton}
        <button on:click={logout} class="interactiveIconBackground" style="display:flex;" title="logout">
          <ion-icon name="log-out-outline" style="color:#f00; font-size:{fontSize + 14}px;"></ion-icon>
        </button>
        {:else}
        <button class="interactiveIconBackground" style="display:flex;">{""}</button>
        {/if}
        <button on:click={toggleSettings} class="interactiveIconBackground" style="display:flex;" title="open-settings">
          <ion-icon name="settings" style="color:{fontColorStr}; font-size:{fontSize + 14}px;"></ion-icon>
        </button>
      </div>
    </div>
    {#if displayProgress == true}
    <div class="progressBar2" style="width: 100%">
      <div class="progressBar1" style="width:{(nowPlaying.progressMs/nowPlaying.durationMs)*100}%"></div>
      <!-- <p>{nowPlaying.progressMs}/{nowPlaying.durationMs}</p> -->
    </div>
    {/if}
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
  --main-color: rgb(0, 0, 0);
  --secondary-color: rgba(0, 0, 0, 0.5);
  --font-color: rgb(255, 255, 255);
}

main {
  background: transparent;
}

.backgroundContainer {
  background-color: var(--secondary-color);
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
  background-color: var(--secondary-color);
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
  color: var(--font-color);
  background-color: var(--main-color);
  border-radius: 8px;
  padding: 5px;
  border-color: rgba(0, 0, 0, 0);
}

.button {
  margin: 5px;
  color: var(--font-color);
  background-color: var(--main-color);
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

.progressBar1 {
  height: 10px;
  border-radius: 8px;
  background-color: var(--font-color);
}

.progressBar2 {
  height: 10px;
  border-radius: 8px;
  background-color: var(--main-color);
  margin-top: 10px;
}

.settingsButton {
  width: auto;
  height: 50px;
  padding: 20px;
  border-radius: 8px;
}

.interactiveIconBackground {
  background: transparent; 
  border-color: rgba(0, 0, 0, 0);
}

h2 {
  text-align: center;
  color: var(--font-color);
}
h1 {
  text-align: center;
  color: var(--font-color);
}
p {
  text-align: center;
  color: var(--font-color);
}

</style>
