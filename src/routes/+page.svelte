<!-- TO DO:
- Redesign Subsonic and Spotify API intergration
-->

<!-- Made by Ashstashp -->

<script lang="ts">

  const notPlaying: Song = {
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

  // Imports:

  import { platform } from "@tauri-apps/plugin-os";

  import {message} from "@tauri-apps/plugin-dialog";
  import { invoke } from "@tauri-apps/api/core";

  // Provider API's
  import { Subsonic } from "../api/subsonic";
  import { type Playlist, type Album, type Song, type Player } from "../api/subsonic";

  import { Spotify } from "../api/spotify";

  import { readFile, writeFile } from "../api/storage";

  //Spotify Logos
  import spotify_full_black from "../assets/2024-spotify-full-logo/Full_Logo_Black_CMYK.svg";
  import spotify_full_green from "../assets/2024-spotify-full-logo/Full_Logo_Green_CMYK.svg";

  // Selfhosted (Unofficial Subsonic API) logos
  // import selfHosted_icon from "../assets/selfhosted-logos/selfhosted_logo.png";
  import selfHosted_icon_full from "../assets/selfhosted-logos/selfhosted_logo_full_white.png";

  // App Logo
  // import logo from "../assets/app-logos/app_logo.svg";
  import logo_full from "../assets/app-logos/app_logo_full.png";

  // Settings Logo
  import settingsIcon_full from "../assets/icons/settings_full.png";
  
  import { onMount } from "svelte";

  ////////////////////////////////////////////////////////////////
  ///////////////////////// Helpful Stuff ////////////////////////
  ////////////////////////////////////////////////////////////////

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

  let nowPlaying: Song = {
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
  };

  let repeat = false;

  ///////////////////////////////////////////////////////////////
  ///////////////////////// Keyring Info ////////////////////////
  ///////////////////////////////////////////////////////////////
  
  const appId = "com.ashstashp.nowplaying-app";

  async function addKeyring(userId:string, token: string) {
    try {
    await invoke("store_user_token", {appId, userId, token})
    } catch (err) {
      showError(err);
    }
  }

  export async function getPassword(userId: string): Promise<string | null> {
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
    try {
      player.unload();
    } catch{}
    loggedIn = false;
  }

  async function login() {
    writeFile("provider", selectedProvider, "client");
    // console.log(selectedProvider)

    if (selectedProvider == "subsonic") {
      if (version.trim() == "") {
        version = "1.16.1";
      }
      try {
        connectSubsonic();
      } catch(e) {
        console.log(e);
        showWarn("Failed to login");
        logout();
        console.log(selectedProvider);
        // console.log(loggedIn);
      }
      // console.log("User: "+ username);
      // console.log()
    } else if (selectedProvider == "spotify"){
      writeFile("provider", "spotify", "client");

      try {
        connectSpotify();
      } catch (e) {
        console.log(e);
        showWarn("Failed to login");
        logout();
      }
    }else {
      showWarn("Provider Not Supported");
    }

    if (autoLogin) {
      if (unsecureKeyrings) {
        saveUnsecureKeyrings();
      } else if (currentPlatform == "windows" || currentPlatform == "macos") {
        saveSecureKeyrings();
      }
    }
  }

  // Makes the stuff needed
  let subsonicUrl = "";
  let username = "";
  let password = "";
  let version = "1.16.1";
  let imageUrl = "N/A";
  let player: Player;

  /////////////////////////////////////////////////////////////////
  ///////////////////////// Subsonic Stuff ////////////////////////
  /////////////////////////////////////////////////////////////////

  // async function refreshSubsonic() {
  //     if (autoLogin) {
  //       writeFile("provider", "subsonic", "client");
  //     } 

  //     if (version.trim() == "") {
  //       version = "1.16.1";
  //     }
  //     try {
  //       player = new Subsonic(username, password, subsonicUrl, version);
  //     } catch(err) {
  //       logout();
  //       console.log(err)
  //       showWarn("Login Failed");
  //     }
  // }

  async function connectSubsonic() {
    try {
      // Connect
      player = new Subsonic(username, password, subsonicUrl, version);
      // Playlists and Albums
      await player.loadPlaylists();
      await player.loadAlbums();
      selectedPlaylist = player.playlists[0];
      selectedAlbum = player.albums[0];

      // Repeat
      setInterval(() => {if (player) {nowPlaying = player.nowPlaying; repeat = player.repeat}}, 100)
      // player.setVolume(50);
      
      // Volume
      await player.setVolume(Number(await readFile("volume", "playback")));
      // console.log("LOADED VOLUME: " + player.volume);
      volume = await player.volume;
      setInterval(updateVolBar, 1);
      setInterval(updatePlaybackData, 10000)

      loggedIn = true;
    } catch(e) {
      logout();
      showError(e);
    }
  }


  ////////////////////////////////////////////////////////////////
  ///////////////////////// Spotify Stuff ////////////////////////
  ////////////////////////////////////////////////////////////////

  let CLIENT_ID = "";
  // let market = "";

  let globalCode = null;

  async function connectSpotify() {

    try {
    player = new Spotify(CLIENT_ID);
    setInterval(() => {if (player) {nowPlaying = player.nowPlaying; repeat = player.repeat}}, 100)
    // await player.loadPlaylists();
    selectedPlaylist = player.playlists[0];
    loggedIn = true;
    } catch (e) {
      showWarn(e);
      logout();
    }

    loggedIn = true;
  }

  /*
  async function refreshSpotify() {
    if (autoLogin) {
      writeFile("provider", "spotify", "client");
    } 

    let error: any = null;
    try {
      const result = await spotifyNowPlaying();
      player.nowPlaying = result;
      imageUrl = player.nowPlaying?.artworkUrl
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
          player.nowPlaying = notPlaying;
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
      player.nowPlaying = null;
      loggedIn = false;
      selectProvider("");
      if (errorCount >= errorLimit) {
        error = {name: "error_limit", message: "Error limit reached or Request timed out"}
      }
      showError(error.name + ": " + error.message);
    }
  }
  */

  ///////////////////////////////////////////////////////////
  ///////////////////////// UI Stuff ////////////////////////
  ///////////////////////////////////////////////////////////

  let mainColor = [0, 0, 0];
  let fontColor = [255, 255, 255];
  let secondaryColor = [0, 0, 0, 0.5];

  let mainColorStr = "rgb(0, 0, 0)";
  let fontColorStr = "rgb(255, 255, 255)";
  let secondaryColorStr = "rgba(0, 0, 0, 0.5)";

  function updateProgressBar() {
    let percent = 0;
    if (player) {
      percent = (player.nowPlaying.progressMs / player.nowPlaying.durationMs) * 100;
    } else {
      percent = 0;
    }

    document.documentElement.style.setProperty("--dur-ptc", percent + "%")
  }

  async function updateVolBar() {
    if (loggedIn && selectedProvider != "spotify") {
      // console.log("Updating Volume Bar");
      // console.log("Done?");
      let percent: number = player.stream.volume * 100;

      if (!percent) {
        percent = 100;
      }

      // console.log(percent);
      document.documentElement.style.setProperty("--vol-ptc", percent + "%")
    }
  }

  async function updatePlaybackData() {
    await writeFile("volume", player.volume.toString(), "playback"); 
    // console.log("Playback Data Updated");
  }

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

  const appVersion = "v1.0.0";

  // Artsize + Fontsize
  let artSize = 200;
  let fontSize = 16;

  // Auto login and show progress bar
  let autoLogin = false;
  let displayProgress = true;
  
  // Platform and verification
  let currentPlatform = "unknown"; 
  let acceptedTos = false;
  let showVoidTosWarn = false;

  // Show Settings
  let showSettings = false;
  let showExperimental = false;

  // Toggable Elements
  let showLogoutButton = true;
  let showAlbumArt = true;
  let showAttribution = false;

  // Open pages
  async function openLegal() {
    open("https://ashstashp.com/legal.html")
  }

  async function open(url: string) {
    await invoke("open_in_browser", { url });
  }

  // Unsecure Keyrings
  let unsecureKeyrings = false; // Stores keychains unsecurley - for Linux users mainly.

  async function loadUnsecureKeyrings() {
    try {
      if (selectedProvider == "subsonic") {
        subsonicUrl = await readFile("subsonic-url", "experimental/unsecure_keyrings");
        username = await readFile("subsonic-username", "experimental/unsecure_keyrings");
        password = await readFile("subsonic-password", "experimental/unsecure_keyrings");
        version = await readFile("subsonic-version", "experimental/unsecure_keyrings");
        // console.log(subsonicUrl);
      } else if (selectedProvider == "spotify") {
        CLIENT_ID = await readFile("spotifyclient_id", "experimental/unsecure_keyrings");
      } else if (selectedProvider == "") {
        throw new Error("No Provider Listed")
      } else {
        throw new Error("Provider not supported");
      }
    } catch(e) {
      showWarn(e);
    }
    // console.log("loaded unsecure keyrings");
  }

  async function clearUnsecureKeyrings() {
    await writeFile("subsonic-url", "", "experimental/unsecure_keyrings");
    await writeFile("subsonic-username", "", "experimental/unsecure_keyrings");
    await writeFile("subsonic-password", "", "experimental/unsecure_keyrings");
    await writeFile("subsonic-version", "", "experimental/unsecure_keyrings");
    await writeFile("spotify-client_id", "", "experimental/unsecure_keyrings");
    // console.log("cleared unsecure keyrings");
  }

  async function saveUnsecureKeyrings() {
    try {
      if (selectedProvider == "subsonic") {
        await writeFile("subsonic-url", subsonicUrl.toString(), "experimental/unsecure_keyrings");
        await writeFile("subsonic-username", username.toString(), "experimental/unsecure_keyrings");
        await writeFile("subsonic-password", password.toString(), "experimental/unsecure_keyrings");
        await writeFile("subsonic-version", version.toString(), "experimental/unsecure_keyrings");
        // console.log(subsonicUrl);
      } else if (selectedProvider == "spotify") {
        await writeFile("spotifyclient_id", CLIENT_ID.toString(), "experimental/unsecure_keyrings")
      } else {
        clearUnsecureKeyrings();
        throw new Error("Provider not found.")
      }
    } catch(e) {
      showWarn(e);
    }
    // console.log("saved unsecure keyrings");
  }

  // Secure Keyrings
  async function saveSecureKeyrings() {
    try {
      if (currentPlatform == "windows" || currentPlatform == "macos") {
        if (selectedProvider == "subsonic") {
          await addKeyring("subsonic-server", subsonicUrl);
          await addKeyring("subsonic-user", username);
          await addKeyring("subsonic-password", password);
          await addKeyring("subsonic-version", version);
        } else if (selectedProvider == "spotify"){
          await addKeyring("spotify-client-id", CLIENT_ID)
        } else {
          throw new Error("Provider missing or not supported");
        }
      } else {
        throw new Error("Platform not supported.")
      }
    } catch(e) {
      showWarn(e);
    }
    // console.log("Saved secure keyrings");
  }

  async function loadSecureKeyrings() {
    try {
      if (currentPlatform == "windows" || currentPlatform == "macos") {
        if (selectedProvider == "subsonic") {
          subsonicUrl = await getPassword("subsonic-server");
          username = await getPassword("subsonic-user");
          password = await getPassword("subsonic-password");
          version = await getPassword("subsonic-version");
        } else if (selectedProvider == "spotify") {
          CLIENT_ID = await getPassword("spotify-client-id");
        } else {
          throw new Error("Provider not found");
        }
      } else {
        throw new Error("Platform not supported");
      }
    } catch(e) {
      showWarn(e);
    }
    // console.log("loaded secure keyrings");
  }

  async function clearSecureKeyings() {
    await deletePassword("subsonic-server");
    await deletePassword("subsonic-user");
    await deletePassword("subsonic-password");
    await deletePassword("subsonic-version");
    await deletePassword("subsonic-server");
    await deletePassword("spotify-client-id");
    // console.log("cleared secure keyrings");
  }

  // Tos stuff
  async function acceptTos() {
    acceptedTos = true;
    await writeFile("tos", acceptedTos.toString(), "legal");
  }

  async function voidTos() {
    acceptedTos = false;
    await writeFile("tos", acceptedTos.toString(), "legal");
    await invoke("close_app");
  }

  
  // Toggle Elements
  function toggleShowLogoutButton() {
    showLogoutButton = !showLogoutButton;
  }

  function toggleDisplayProgress() {
    displayProgress = !displayProgress;
  }

  function toggleShowAttribution() {
    showAttribution = !showAttribution;
  }

  // Toggle AutoLogin feature
  function toggleAutoLogin() {
    autoLogin = !autoLogin;
  }

  // Toggle settings screen
  function toggleSettings() {
    showSettings = !showSettings;
  }

  function toggleExperimental() {
    showExperimental = !showExperimental;
  }

  function toggleShowAlbumArt() {
    showAlbumArt = !showAlbumArt
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

  // Experimental Settings Logic
  function toggleUnsecureKeyrings() {
    unsecureKeyrings =! unsecureKeyrings;
    if (unsecureKeyrings) {
      saveUnsecureKeyrings();
    } else {
      clearUnsecureKeyrings();
    }
  }

  // Restore defaults
  function restoreDefaults() {
    showLogoutButton = true;
    fontSize = 16;
    artSize = 200;
    autoLogin = false;
    displayProgress = true;
    showAlbumArt = true;
    showAttribution = false;
    unsecureKeyrings = false;
    updateSettingsFiles();
  }

  // Save and Discard settings
  function saveSettings() {
    updateSettingsFiles();
    toggleSettings();
  }

  function discardSettings() {
    loadSettingsFiles();
    toggleSettings();
  }

  // Autologin logic
  async function runAutoLogin() {
    // Incase of errors cause yk-
    try {
      // Gets provider
      selectedProvider = await readFile("provider", "client")
      // console.log("Selected Provider: " +selectedProvider);
      // Checks if provider is spotify
      if (unsecureKeyrings) {
        await loadUnsecureKeyrings();
        if (selectedProvider == "spotify") {
          await connectSpotify();
        } else if (selectedProvider == "subsonic") {
          await connectSubsonic();
        } else {
          throw new Error("Provider not supported or listed.")
        }
      } else {
        await loadSecureKeyrings();
        if (selectedProvider == "spotify") {
          await connectSpotify();
        } else if (selectedProvider == "subsonic") {
          await connectSubsonic();
        } else {
          throw Error("INVALID_PROVIDER");
        }
      }
    } catch(err) {
      showError("Auto Login Failed:\n" + err);
      logout();
    }
  }

  // Update and load settings from AppData
  async function updateSettingsFiles() {
    await writeFile("fontSize", fontSize.toString(), "settings");
    await writeFile("artSize", artSize.toString(), "settings");
    await writeFile("showLogoutButton", showLogoutButton.toString(), "settings");
    await writeFile("autoLogin", autoLogin.toString(), "settings");
    await writeFile("displayProgress", displayProgress.toString(), "settings");
    await writeFile("showAlbumArt", showAlbumArt.toString(), "settings");
    await writeFile("showAttribution", showAttribution.toString(), "settings");
    await writeFile("unsecureKeyrings", unsecureKeyrings.toString(), "settings/experimental")
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
    if (whatDisplayProgress == "true" || whatDisplayProgress == "truee") {
      displayProgress = true;
    } else {
      displayProgress = false;
    }

    const whatShowAlbumArt = await readFile("showAlbumArt", "settings")
    if (whatShowAlbumArt == "true" || whatShowAlbumArt == "truee") {
      showAlbumArt = true;
    } else {
      showAlbumArt = false;
    }

    const whatShowAttribution = await readFile("showAttribution", "settings")
    if (whatShowAttribution == "true" || whatShowAttribution == "truee") {
      showAttribution = true;
    } else {
      showAttribution = false;
    }

    const whatAcceptedTos = await readFile("tos", "legal")
    if (whatAcceptedTos == "true" || whatAcceptedTos == "truee") {
      acceptedTos = true;
    } else {
      acceptedTos = false;
    }

    const whatUnsecureKeyrings = await readFile("unsecureKeyrings", "settings/experimental");
    if (whatUnsecureKeyrings == "true" || whatUnsecureKeyrings == "truee") {
      unsecureKeyrings = true;
    } else {
      unsecureKeyrings = false;
    }
  }

  // Waits till mount (for linux mainly)
  onMount(async () => {
    try {
      currentPlatform = await platform();
      await loadSettingsFiles();
      if (autoLogin && (currentPlatform == "windows" || currentPlatform == "macos" || unsecureKeyrings == true)) {
        if (acceptedTos) {
          await runAutoLogin();
        }
      }
    } catch (err) {
      showError("Failed to load saved settings.\n" + err);
    }
  });

  ///////////////////////////////////////////////////////////////
  ///////////////////////// Library Page ////////////////////////
  ///////////////////////////////////////////////////////////////
  let showLibrary = false;
  let showPlaylist = false;
  let showAlbum = false;
  let showSong = false;
  let showArtist = false;

  let queue: Array<string> = [];
  
  let selectedPlaylist: Playlist;
  let selectedAlbum: Album;
  let selectedSong: Song;
  let selectedArtist: string;

//   function makeQueue(list) {
//     for (const i in list.songs) {
//       const song = list.songs[i]
// //      console.log(song.id);
//       queue.push(song.id);
//     }
//     // console.log(queue);
//   }

//   function clearQueue() {
//     queue = [];
//   }

//   function shuffleQueue() {
//     const shuffled = queue.sort(() => Math.random() - 0.5);
//     queue = shuffled;
//     // console.log(queue);
//   }

  function toggleLibrary() {
    showLibrary = !showLibrary;
    // console.log(player.playlists);
    // console.log(player.albums);
  };

  function togglePlaylist() {
    showPlaylist = !showPlaylist;
  }

  function toggleAlbum() {
    showAlbum = !showAlbum;
  }

  function toggleShowSong() {
    showSong = !showSong;
  }

  function toggleShowArtist() {
    showArtist = !showArtist;
  }

  function setSelectedPlaylist(playlist: Playlist) {
    selectedPlaylist = playlist;
  }

  function setSelectedAlbum(album: Album) {
    selectedAlbum = album;
  }

  function setSelectedSong(song: Song) {
    selectedSong = song;
  }

  function setSelectedArtist(artist: string) {
    selectedArtist = artist;
  }

  //////////////////////////////////////////////////////////////
  //////////////////////////// Audio ///////////////////////////
  //////////////////////////////////////////////////////////////

  function checkTime() {
    if (selectedProvider == "" || !loggedIn) {
      try {
        player.unload();
      } catch {

      }
    }
    else if (selectedProvider == "subsonic" && player && player.nowPlaying.isPlaying) {
      // console.log(player.nowPlaying.progressMs);
      progress = player.nowPlaying.progressMs;
      if (player.stream.currentTime >= player.stream.duration) {
        player.nextSong();
        progress = 0;
      }
    }
    if (player && player.stream) {
      progress += 1;
    } else {
      progress = player? player.nowPlaying.progressMs : 0;
    }
    updateProgressBar();
  }

  let volume = 100;
  let progress = 0;

  setInterval(checkTime, 1);
  if (selectedProvider == "subsonic") {
    setInterval(updateVolBar, 1);
  }

  ///////////////////////////////////////////////////////////////
  ///////////////////////// Progress Bar ////////////////////////
  ///////////////////////////////////////////////////////////////

  // refresh stuff
  // async function refresh() {
  //   if (selectedProvider == "subsonic" && loggedIn) {
  //     refreshSubsonic();
  //   } else if (selectedProvider == "spotify" && loggedIn) {
  //     refreshSpotify();
  //   }
  // }

  // // Refresh content
  // setInterval(refresh, 2000);
  // refresh();
</script>

<main class="container">
<script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></script>
<script nomodule src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"></script>

<!-------------------------------------------------------->
<!------------------- Settings Screen -------------------->
<!-------------------------------------------------------->
{#snippet settings()}
  {#if showExperimental}
    {@render experimentals()}
  {:else}
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

    <h1 style="font-size: {fontSize + 16}px">Album Art:</h1>
    {#if showAlbumArt == true}
    <!-- Album Art Size -->
    <div style="display:flex; flex-direction: s-clienrow; align-items: center; justify-content: center;">
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
      <h2 style="font-size: {fontSize + 8}px">Preview:</h2>
      {#if selectedProvider == "spotify"}
        <img src={spotify_full_green} alt="Spotify Logo" style="margin: 5px; width: {artSize}px; height: auto;"/>
      {/if}
      {#if player && nowPlaying.isPlaying == true}
        <img class="albumArt" style="width:{artSize}px; height:{artSize}px; border-radius:8px;" src={nowPlaying? nowPlaying.artworkUrl : player.nowPlaying.artworkUrl} alt="Preview"/>
      {:else}
        <ion-icon name="musical-note-outline" style="font-size:{artSize}px; color:{fontColorStr}"></ion-icon>
      {/if}
    </div>
    {/if}
    <button class="button" style="font-size: {fontSize}px; display:flex; flex-direction: row; justify-content: space-between;" on:click={toggleShowAlbumArt}>
      <p style="font-size: {fontSize}px; test-align:left;">Show Album Art:</p>
      <p style="font-size: {fontSize}px; color: {showAlbumArt? "#0f0" : "#f00"};">{showAlbumArt}</p>
    </button>

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
        <p style="font-size: {fontSize}px; color: {unsecureKeyrings == true || currentPlatform == "windows" || currentPlatform == "macos"? autoLogin? "#0f0" : "#f00" : "#f00"};">{unsecureKeyrings == true || currentPlatform == "windows" || currentPlatform == "macos"? autoLogin : "Unavailable"}</p>
      </button>
      <button class="button" style="font-size: {fontSize}px; display:flex; flex-direction: row; justify-content: space-between;" on:click={toggleDisplayProgress}>
        <p style="font-size: {fontSize}px; test-align:left;">Display Progress Bar:</p>
        <p style="font-size: {fontSize}px; color: {displayProgress? "#0f0" : "#f00"};">{displayProgress}</p>
      </button>
      <button class="button" style="font-size: {fontSize}px; display:flex; flex-direction: row; justify-content: space-between;" on:click={toggleShowAttribution}>
        <p style="font-size: {fontSize}px; test-align:left;">Show Attribution (app logo):</p>
        <p style="font-size: {fontSize}px; color: {showAttribution? "#0f0" : "#f00"};">{showAttribution}</p>
      </button>
    </div>

    <br>
    <!-- Show Experimental Settings -->
    <button class="button" style="font-size: {fontSize}px" on:click={toggleExperimental}>Open Experimental Settings</button>

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
    <button class="button" style="font-size: {fontSize}px; color: #f00;" on:click={voidTos}>Void TOS</button>
  </div>
  {/if}
{/snippet}

{#snippet experimentals()}
  <div class="loginContainer">
    <!-- Unsecure Keyrings -->
     <h1 style="font-size: {fontSize + 16}px">Experimental Settings:</h1>
    <div style="display:flex; flex-direction: column;">
      <button class="button" style="font-size: {fontSize}px; display:flex; flex-direction: row; justify-content: space-between;" on:click={toggleUnsecureKeyrings}>
        <p style="font-size: {fontSize}px; test-align:left;">Unsecure Keyrings:</p>
        <p style="font-size: {fontSize}px; color: {unsecureKeyrings? "#0f0" : "#f00"};">{unsecureKeyrings}</p>
      </button>
    </div>

    <br>
    <button class="button" style="font-size: {fontSize}px" on:click={toggleExperimental}>Return</button>
  </div>
{/snippet}

<!----------------------------------------------------------->
<!---------------- Playlist & Album Screens ----------------->
<!----------------------------------------------------------->
{#snippet playlist(playlist: Playlist)}
  <div class="loginContainer">
    {#if selectedProvider == "spotify"}
      <img src={spotify_full_green} alt="Spotify Logo" style="margin: 5px; height: {50+fontSize}px;"/>
    {/if}
    <div style="display:flex; flex-direction: row; padding: 20px; background-color:{mainColorStr}; border-radius:8px; margin: 10px;">
      <img class="albumCover" style="height:{artSize*(3/4)}px; width:{artSize*(3/4)}px; margin-right: 10px;" src={playlist.artworkUrl} alt="Playlist Artwork"/>
      <div style="display:flex; flex-direction: column; align-items:center; justify-content: center;">
        <h2>{playlist.title}</h2>
        <p>{playlist.comment}</p>
      </div>
      <button class="interactiveIconBackground" on:click={() => {player.makeQueue(playlist); selectedProvider == "subsonic"? player.play(player.queue[0]): player.play(playlist.id)}} title="Play Playlist">
        <ion-icon name="play-circle" style="color:{fontColorStr}; font-size:{fontSize + 14}px; align-self:center; justify-self:flex-end;"></ion-icon>
      </button>
      <button class="interactiveIconBackground" on:click={() => {player.makeQueue(playlist); player.shuffleQueue(); player.play(player.queue[0])}} title="Play Playlist">
        <ion-icon name="shuffle" style="color:{fontColorStr}; font-size:{fontSize + 14}px; align-self:center; justify-self:flex-end;"></ion-icon>
      </button>
    </div>

    <div style="padding: 10px; background-color:{mainColorStr}; border-radius:8px; margin: 10px;">
      {#each playlist.songs as song}
        <div style="display:flex; flex-direction: row; padding: 5px; margin: 5px; border-radius: 8px; border-style: solid; border-width: 2px; border-color: {fontColorStr}">
          <img class="albumCover" style="height:{artSize*(1/2)}px; width:{artSize*(1/2)}px; margin-right: 10px;" src={song.artworkUrl} alt="Playlist Artwork"/>
          <div style="display:flex; flex-direction: column; align-items:center; justify-content: center; padding:0px">
            <h2 style="margin:-5px">{song.title}</h2>
            <p>{song.artist}</p>
          </div>
          <button class="interactiveIconBackground" on:click={() => {player.clearQueue(); player.play(song.id)}} title="Play Playlist">
            <ion-icon name="play-circle" style="color:{fontColorStr}; font-size:{fontSize + 14}px; align-self:center; justify-self:flex-end;"></ion-icon>
          </button>
        </div>
      {/each}
    </div>
    <button class="button" style="font-size: {fontSize}px" on:click={togglePlaylist}>Back</button>
  </div>
{/snippet}

{#snippet album(album: Album)}
  <div class="loginContainer">
    {#if selectedProvider == "spotify"}
      <img src={spotify_full_green} alt="Spotify Logo" style="margin: 5px; height: {50+fontSize}px;"/>
    {/if}
    <div style="display:flex; flex-direction: row; padding: 20px; background-color:{mainColorStr}; border-radius:8px; margin: 10px;">
      <img class="albumCover" style="height:{artSize*(3/4)}px; width:{artSize*(3/4)}px; margin-right: 10px;" src={album.artworkUrl} alt="Playlist Artwork"/>
      <div style="display:flex; flex-direction: column; align-items:center; justify-content: center;">
        <h2>{album.title}</h2>
        <p>{album.artist}</p>
      </div>
      <button class="interactiveIconBackground" on:click={() => {player.makeQueue(album); player.play(player.queue[0])}} title="Play Playlist">
        <ion-icon name="play-circle" style="color:{fontColorStr}; font-size:{fontSize + 14}px; align-self:center; justify-self:flex-end;"></ion-icon>
      </button>
      <button class="interactiveIconBackground" on:click={() => {player.makeQueue(album); player.shuffleQueue(); player.play(player.queue[0])}} title="Play Playlist">
        <ion-icon name="shuffle" style="color:{fontColorStr}; font-size:{fontSize + 14}px; align-self:center; justify-self:flex-end;"></ion-icon>
      </button>
    </div>

    <div style="padding: 10px; background-color:{mainColorStr}; border-radius:8px; margin: 10px;">
      {#each album.songs as song}
        <div style="display:flex; flex-direction: row; padding: 5px; margin: 5px; border-radius: 8px; border-style: solid; border-width: 2px; border-color: {fontColorStr}">
          <img class="albumCover" style="height:{artSize*(1/2)}px; width:{artSize*(1/2)}px; margin-right: 10px;" src={song.artworkUrl} alt="Playlist Artwork"/>
          <div style="display:flex; flex-direction: column; align-items:center; justify-content: center; padding:0px">
            <h2 style="margin:-5px">{song.title}</h2>
            <p>{song.artist}</p>
          </div>
          <button class="interactiveIconBackground" on:click={() => {player.clearQueue(); player.play(song.id)}} title="Play Playlist">
            <ion-icon name="play-circle" style="color:{fontColorStr}; font-size:{fontSize + 14}px; align-self:center; justify-self:flex-end;"></ion-icon>
          </button>
        </div>
      {/each}
    </div>
    <button class="button" style="font-size: {fontSize}px" on:click={toggleAlbum}>Back</button>
  </div>
{/snippet}

<!------------------------------------------------------->
<!------------------- Library Screen -------------------->
<!------------------------------------------------------->
{#snippet library()}
  {#if showPlaylist}
    {@render playlist(selectedPlaylist)}
  {:else if showAlbum}
    {@render album(selectedAlbum)}
  {:else}
  <div class="loginContainer">
    {#if selectedProvider != "spotify"}
        <h1>Library</h1>
    {:else}
          <img src={spotify_full_green} alt="Spotify Logo" style="margin: 5px; height: {50+fontSize}px;"/>
    {/if}
      <h2>Playlists:</h2>
        {#each player.playlists as playlist}
          <button style="background: transparent; border-color:rgba(0, 0, 0, 0)" on:click={() => {setSelectedPlaylist(playlist); togglePlaylist()}}>
            <div style="display:flex; flex-direction: row; padding: 20px; background-color:{mainColorStr}; border-radius:8px; margin: 10px;">
              <img class="albumCover" style="height:{artSize*(3/4)}px; width:{artSize*(3/4)}px; margin-right: 10px;" src={playlist.artworkUrl} alt="Playlist Artwork"/>
              <div style="display:flex; flex-direction: column; align-items:center; justify-content: center;">
                <h2>{playlist.title}</h2>
                <p>{playlist.comment}</p>
              </div>
            </div>
          </button>
        {/each}
      <h2>Albums</h2>
        {#each player.albums as album}
          <button style="background: transparent; border-color:rgba(0, 0, 0, 0)" on:click={() => {setSelectedAlbum(album); toggleAlbum()}}>
            <div style="display:flex; flex-direction: row; padding: 20px; background-color:{mainColorStr}; border-radius:8px; margin: 10px;">
              <img class="albumCover" style="height:{artSize*(3/4)}px; width:{artSize*(3/4)}px; margin-right: 10px;" src={album.artworkUrl} alt="Playlist Artwork"/>
              <div style="display:flex; flex-direction: column; align-items:center; justify-content: center;">
                <h2>{album.title}</h2>
                <p>{album.artist}</p>
              </div>
            </div>
          </button>
        {/each}
    <!-- {/if} -->
    <button class="button" style="font-size: {fontSize}px" on:click={toggleLibrary}>Close</button>
  </div>
  {/if}
{/snippet}


<!--------------------------------------------------------------------------------------->
<!------------------------------------- Accept TOS -------------------------------------->
<!--------------------------------------------------------------------------------------->

{#if acceptedTos == false}
  <div class="loginContainer">
    <h1>Terms of Service</h1>
    <p>By pressing "Accept" below, you agree to our terms of service. Press "View Terms of Service" to review the terms of service.</p>
    <button class="button" on:click={() => open("https://files.ashstashp.com/nowPlaying_app/legal/tos.txt")}>View Terms of Service</button>
    <button class="button" on:click={acceptTos}>Accept</button>
    <button class="button" on:click={voidTos}>Decline</button>
  </div>


<!---------------------------------------------------------------------------------------------->
<!------------------------------------- Provider Selector -------------------------------------->
<!---------------------------------------------------------------------------------------------->
{:else if selectedProvider == "" && !showSettings}
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
      <h1 style="color: #f90"><ion-icon name="warning"></ion-icon> Warning: Spotify Premium Required! <ion-icon name="warning"></ion-icon></h1>
      <form on:submit={login} style="display: flex; flex-direction: column;">
        <input required style="font-size: {fontSize}px" bind:value={CLIENT_ID} placeholder="Enter your Client ID"/>
        <!-- <input maxlength="2" style="font-size: {fontSize}px" bind:value={market} placeholder="Market/Country Code (i.g USA -> US) *NOT REQUIRED*"/> -->
        <!-- <button class="button" style="font-size: {fontSize}px; background-color: {mainColorStr}" on:click={() => open("https://www.spotify.com/account/overview/")} type="button">Find Market!</button> -->
        <button class="button" style="font-size: {fontSize}px; background-color: #1ED760" type="submit">Login</button>
      </form>
      {#if currentPlatform == "windows" || currentPlatform == "macos" || unsecureKeyrings}
        <button class="button" style="font-size: {fontSize}px" on:click={() => {unsecureKeyrings? saveUnsecureKeyrings() : saveSecureKeyrings()}}>Save Spotify Login</button>
        <button class="button" style="font-size: {fontSize}px" on:click={() => {unsecureKeyrings? loadUnsecureKeyrings() : loadSecureKeyrings()}}>Load Spotify Login</button>
        <button class="button" style="font-size: {fontSize}px; color: #f00;" on:click={() => {unsecureKeyrings? clearUnsecureKeyrings() : clearSecureKeyings()}}>Delete Saved Spotify Login</button>
      {:else}
        <p class="button" style="font-size:{fontSize}px;">Keyrings are not supported for your OS.</p>
      {/if}
      <button class="button" style="font-size: {fontSize}px" on:click={() => {selectProvider("")}}>Back</button>
    </div>

  <!-- Subsonic Login Page -->
  {:else if selectedProvider == "subsonic"}
    <div class="loginContainer" >
      <form on:submit={login} style="display: flex; flex-direction: column;">
        <input required style="font-size: {fontSize}px" bind:value={subsonicUrl} placeholder="Enter your Server URL"/>
        <input required style="font-size: {fontSize}px" bind:value={version} placeholder="Enter your Server Version (Default is 1.16.1)"/>
        <input required style="font-size: {fontSize}px" bind:value={username} placeholder="Enter your Username"/>
        <input required style="font-size: {fontSize}px" type="password" bind:value={password} placeholder="Enter your Password"/>
        <button class="button" style="font-size: {fontSize}px" type="submit">Login</button>
      </form>
      {#if currentPlatform == "windows" || currentPlatform == "macos" || unsecureKeyrings}
        <button class="button" style="font-size: {fontSize}px" on:click={() => {unsecureKeyrings? saveUnsecureKeyrings() : saveSecureKeyrings()}}>Save Subsonic Login</button>
        <button class="button" style="font-size: {fontSize}px" on:click={() => {unsecureKeyrings? loadUnsecureKeyrings() : loadSecureKeyrings()}}>Load Subsonic Login</button>
        <button class="button" style="font-size: {fontSize}px; color: #f00;" on:click={() => {unsecureKeyrings? clearUnsecureKeyrings() : clearSecureKeyings()}}>Delete Subsonic Login
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
  {:else if showLibrary}
    {@render library()}
  {:else if showPlaylist}
    {@render playlist(selectedPlaylist)}
  {:else}
  <div class="backgroundContainer" style="display: flex; flex-direction: column; justify-content:center;">
    {#if showAttribution == true}
      <div style="display:flex; flex-direction:row; align-items: flex-start; justify-content: flex-start;">
        <img style="width:auto; height:{fontSize + 40}px" src={logo_full} alt="NowPlayingApp Logo"/>
      </div>
    {/if}
    <div style="display: flex; flex-direction: row; justify-content:space-between;">
      <!-- Main Content -->
      <div style="display:flex; flex-direction: row;">
        <div style="display: flex; flex-direction: column;">
          {#if selectedProvider == "spotify"}
            <img src={spotify_full_green} alt="Spotify Logo" style="margin: 5px;"/>
          {/if}
          {#if showAlbumArt == true && (nowPlaying? nowPlaying.isPlaying == true : player.nowPlaying.isPlaying == true)}
          <img class="albumCover" style="height:{artSize}px; width:{artSize}px;" src={(nowPlaying? (nowPlaying.artworkUrl? nowPlaying.artworkUrl : "N/A"): (player.nowPlaying.artworkUrl? player.nowPlaying.artworkUrl : "N/A"))} alt={`Cover art for ${(nowPlaying? nowPlaying.title : player.nowPlaying.title)} by ${nowPlaying? nowPlaying.artist : player.nowPlaying.artist}`} />
          {:else if showAlbumArt == true}
          <ion-icon name="musical-note-outline" style="font-size:{artSize}px; color:{fontColorStr}"></ion-icon>
          {/if}
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <h1 style="font-size: {fontSize + 16}px;">{nowPlaying? nowPlaying.title : player.nowPlaying.title}</h1>
          <h2 style="font-size: {fontSize + 8}px;">{nowPlaying? nowPlaying.artist : player.nowPlaying.artist}</h2>


          <!-- Playback Control -->
          <div>
            <button on:click={() => player.prevSong()} class="interactiveIconBackground" title="Previous Song">
              <ion-icon name="play-back" style="color:{fontColorStr}; font-size:{fontSize + 14}px;"></ion-icon>
            </button>
            {#if (nowPlaying? nowPlaying.isPlaying : player.nowPlaying.isPlaying) && (nowPlaying? !nowPlaying.paused : !player.nowPlaying.paused)}
            <button on:click={() => player.pause()} class="interactiveIconBackground" title="Pause">
              <ion-icon name="pause" style="color:{fontColorStr}; font-size:{fontSize + 14}px;"></ion-icon>
            </button>
            {:else if (nowPlaying? nowPlaying.isPlaying : player.nowPlaying.isPlaying) && (nowPlaying? nowPlaying.paused : player.nowPlaying.paused)}
            <button on:click={() => player.resume()} class="interactiveIconBackground" title="Play">
              <ion-icon name="play" style="color:{fontColorStr}; font-size:{fontSize + 14}px;"></ion-icon>
            </button>
            {:else}
            <button on:click={() => {selectedProvider == "subsonic"? player.play("NTt3W8F4HVUawr5QsFLN8a") : player.resume()}} class="interactiveIconBackground" title="Play">
              <ion-icon name="play" style="color:{fontColorStr}; font-size:{fontSize + 14}px;"></ion-icon>
            </button>
            {/if}
            <button on:click={() => {player.nextSong(); progress = 0;}} class="interactiveIconBackground" title="Previous Song">
              <ion-icon name="play-forward" style="color:{fontColorStr}; font-size:{fontSize + 14}px;"></ion-icon>
            </button>
          </div>
          <div style="display:flex; flex-direction: row; align-items: center; justify-content: flex-start;">
            {#if player && selectedProvider == "subsonic"}
            <ion-icon name="{player.volume > 75? "volume-high" : player.volume > 25? "volume-medium" : player.volume > 0? "volume-low" : "volume-off"}" style="color:{fontColorStr}; font-size:{fontSize + 14}px;"></ion-icon>

            <input type="range" class="volume" min=0 max=100 bind:value={volume} on:input={() => player.setVolume(volume)}/>
            {/if}
            <button class="interactiveIconBackground" on:click={() => player.toggleRepeat()} title="toggle-repeat">
            {#if repeat}
            <ion-icon style="color:{fontColorStr}; font-size:{fontSize + 14}px;" name="refresh-circle"></ion-icon>
            {:else}
            <ion-icon style="color:{fontColorStr}; font-size:{fontSize + 14}px;" name="refresh-circle-outline"></ion-icon>
            {/if}
            </button>
          </div>

          
        </div>
        
      </div>

      <!-- Buttons -->
      <div style="display:flex; flex-direction: column; justify-content: space-between;">
        <!-- Logout -->
        {#if showLogoutButton}
        <button on:click={logout} class="interactiveIconBackground" style="display:flex;" title="logout">
          <ion-icon name="log-out-outline" style="color:#f00; font-size:{fontSize + 14}px;"></ion-icon>
        </button>
        {/if}
        <button on:click={toggleLibrary} class="interactiveIconBackground" style="display:flex;" title="open-library">
          <ion-icon name="albums-outline" style="color:{fontColorStr}; font-size:{fontSize + 14}px;"></ion-icon>
        </button>
        <button on:click={toggleSettings} class="interactiveIconBackground" style="display:flex;" title="open-settings">
          <ion-icon name="settings" style="color:{fontColorStr}; font-size:{fontSize + 14}px;"></ion-icon>
        </button>
      </div>
    </div>
    {#if displayProgress == true}
    <!-- <div class="progressBar2" style="width: 100%">
      <div class="progressBar1" style="width:{(nowPlaying.progressMs/nowPlaying.durationMs)*100}%"></div>
      <p>{nowPlaying.progressMs}/{nowPlaying.durationMs}</p>
    </div> -->
    <div style="display:flex; flex-direction: row">
      <ion-icon name="time" style="color:{fontColorStr}; font-size:{fontSize + 14}px;"></ion-icon>
      <input type="range" class="duration" min=0 max={nowPlaying? nowPlaying.durationMs : player.nowPlaying.durationMs} bind:value={progress} on:input={() => player.seek(progress)}/>
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
  --dur-ptc: 0%;
  --vol-ptc: 0%;
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

/* ---------------- */
/* --- Duration --- */
/* ---------------- */

.duration {
  -webkit-appearance: none;
  appearance: none;
  width: 97%;
  background: transparent;
  cursor: pointer;
}

/* --- Webkit Browsers --- */
.duration::-webkit-slider-runnable-track {
  height: 8px;
  background: linear-gradient(
    to right, 
    var(--main-color) 0%,
    var(--main-color) var(--dur-ptc), 
    var(--font-color) var(--dur-ptc),
    var(--font-color) 100%);
  border-radius: 10px;
  border: 0px solid var(--main-color);
  box-shadow: 0px 2px 0px rgba(0, 0, 0, 0.1);
}

.duration::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 24px;
  width: 24px;
  background: var(--main-color);
  border-radius: 30px;
  border: 2px solid var(--font-color);
  box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.3);
  margin-top: -8px;
}

/* --- Firefox --- */
.duration::-moz-range-track {
  height: 8px;
  background: linear-gradient(to right, #6366f1 var(--dur-pct, 0%), #e2e8f0 var(--dur-pct, 0%));
  border-radius: 10px;
  border: 0px solid #cbd5e1;
  box-shadow: 0px 2px 0px rgba(0, 0, 0, 0.1);
}

.duration::-moz-range-thumb {
  height: 24px;
  width: 24px;
  background: #4f46e5;
  border-radius: 30px;
  border: 2px solid #ffffff;
  box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.3);
}

/* -------------- */
/* --- Volume --- */
/* -------------- */

.volume {
  -webkit-appearance: none;
  appearance: none;
  width: 97%;
  background: transparent;
  cursor: pointer;
}

/* --- Webkit Browsers --- */
.volume::-webkit-slider-runnable-track {
  height: 8px;
  background: linear-gradient(
    to right, 
    var(--main-color) 0%,
    var(--main-color) var(--vol-ptc), 
    var(--font-color) var(--vol-ptc),
    var(--font-color) 100%);
  border-radius: 10px;
  border: 0px solid var(--main-color);
  box-shadow: 0px 2px 0px rgba(0, 0, 0, 0.1);
}

.volume::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 24px;
  width: 24px;
  background: var(--main-color);
  border-radius: 30px;
  border: 2px solid var(--font-color);
  box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.3);
  margin-top: -8px;
}

/* --- Firefox --- */
.volume::-moz-range-track {
  height: 8px;
  background: linear-gradient(to right, #6366f1 var(--vol-pct, 0%), #e2e8f0 var(--vol-pct, 0%));
  border-radius: 10px;
  border: 0px solid #cbd5e1;
  box-shadow: 0px 2px 0px rgba(0, 0, 0, 0.1);
}

.volume::-moz-range-thumb {
  height: 24px;
  width: 24px;
  background: #4f46e5;
  border-radius: 30px;
  border: 2px solid #ffffff;
  box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.3);
}

/* ------------------- */
/* --- Other stuff --- */
/* ------------------- */

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

<!-- Made by Ashstashp -->
