# <img src="https://files.ashstashp.com/nowPlaying_app/icons/app_logo_full.png" alt="spotify logo" style="height: 100px;"/>

This application was developed by ashstashp™ and follow the licensing found on https://ashstashp.com/legal.html, unless otherwise specified.

## What does this app do?
This application (NowPlaying App) displays the song that is currently playing on any approved provider, in a clean format! This is designed for streamers, however, we can't exactly control how you use the app...

>[!WARNING]
>This application does not grant the right to publically display any information. Ensure what you are doing is allowed by the artist(s) of any music you are displaying.

## Installation
> [!NOTE]
> Windows is currently the only supported version. I don't have a Mac machiene, and Linuix is being a pain to work with rn.

- Navigate to the "Current Release" folder.
<img src="https://files.ashstashp.com/nowPlaying_app/instructions/installation_1.png" />

- Open the folder of the current operating system you're using.

### Windows
- Open the folder of the installer you wish to use (there usually isn't a difference).
<img src="https://files.ashstashp.com/nowPlaying_app/instructions/installation_3.png" />
  
- Click on the file inside of the folder.
<img src="https://files.ashstashp.com/nowPlaying_app/instructions/installation_4.png" />
  
- Press the download button in the top right.
<img src="https://files.ashstashp.com/nowPlaying_app/instructions/installation_5.png" />
  
- Run the installer, and follow the prompts.

# Approved Providers
Sadly, due to many streaming services now providing a publically available API, it is hard to add providers. However, we have some below:

## <img src="https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Full_Logo_RGB_Green.png" alt="spotify logo" style="height: 70px;"/>

### Setup

> [!IMPORTANT]
> Before you continue, Spotify Premium is required for spotify support. We apologize for any inconvience.

- To use Spotify, navigate to the [Developer Page](https://developers.spotify.com) and create a developer account.
- Navigate to the [Spotify Developer Dashboard](https://developers.spotify.com/dashboard)
<img src="https://files.ashstashp.com/nowPlaying_app/instructions/spotify_1.png" />

- Create an App
<img src="https://files.ashstashp.com/nowPlaying_app/instructions/spotify_2.png" />

- Enter in the required information
  - For "Redirect URL" enter "http://127.0.0.1:1420/callback".
  - For the API/SDK section, only Web API should be selected.
  - Save the application.
<img src="https://files.ashstashp.com/nowPlaying_app/instructions/spotify_3.png" />

### Logging in
- Press the Spotify API button
<img src="https://files.ashstashp.com/nowPlaying_app/instructions/select-spotify.png"/>
  
- Copy and paste your client id into the application, and press "Login."
<img src="https://files.ashstashp.com/nowPlaying_app/instructions/login-spotify.png"/>
  
- Follow the prompts on the browser.
<img src="https://files.ashstashp.com/nowPlaying_app/instructions/login-spotify_2.png"/>

> [!WARNING]
> If you get a blank screen when utalizing the Spotify API, this is because no song is playing. This feature is unintentional, but probably won't be removed. There are two ways to fix it:
>
> 1) Press "Cancel" on the authorization screen, and wait for the error.
> 2) Play music on your Spotify account, and wait for the screen to update.

### Settings
Starting in version v0.1.5, you can save your Spotify client id to a secure keyring on your device, and load it again later.

- To save, press the "Save Client ID" button.
- To load, press the "Load Client ID" button.
- To delet, press the "Delete Saved Client ID" button.

## <img src="https://files.ashstashp.com/nowPlaying_app/promo/selfhosted_logo_full.png" style="height:80px;"/>

> [!IMPORTANT]
> We are not affiliated, nor accociated with Subsonic in any way. We only use their publically available API. This includes the image above, which is custom made for reference purposes and is not affiliated with Subsonic in any way.

>[!NOTE]
> We do not support pirating, and ask that you do not use our applications or services if you have not legally obtained any music.

### Logging in

- Click the orange "Subsonic" button.
<img src="https://files.ashstashp.com/nowPlaying_app/instructions/select-subsonic.png"/>
  
- Enter your server url, version, username, and password.
  - The default version for the Subsonic server is 1.16.1, which is what servers like Navidrome use.
- Press login.
<img src="https://files.ashstashp.com/nowPlaying_app/instructions/login-subsonic.png"/>

### Settings:
Starting in version v0.1.5, you could save your Subsonic login information to a secure keyring on your device.

> [!NOTE]
> Uh, kinda forgot to save the server version too. I will fix this in the next update.

- To save, press the "Save Subsonic Login" button.
- To load, press the "Load Subsonic Login" button.
- To delete, press the "Delete Subsonic Login" button.

## More Coming Soon!
While we only have two options available many self hosted providers use Subsonic! :]

We would love to add support to many more. However, it takes time, and there are sometimes issues with provider API's.

# App Settings:
Starting in v0.1.4, we added a settings tab. You can edit, and save settings for the app here. Below will be a detailed description on what each setting does.

### Font Size:
While this is kinda self explanitory, the way it works might confuse people.

The default value is 16px. The font size is limited to a minimum of 1px. This is the "Base" font size, most font elements are changed based on this value (from +8 to +16 I believe).
All icons are also affected by this value, but it's much less noticable due to their size.

### Art Size:
The size of the album art is 200px^2. The album art size is limited to a minimum of 1px^2. This is the actual image size, and only affects the album art image. There is also a preview of the song you are currently playing available.

### Show Logout button:
Whether or not the logout button is visible on the Now Playing screen.

The default value is true, but can be changed to false.

### Auto Login:
Whether or not the app tries to log into your last used provider on launch. Apart of the Quality of Life (QOL) features.

When enabled, the app will attempt to connect to your last used provider with the saved credentials. This can be disabled.

### Logout:
Visible only when logged in, will log you out of any current used service. Does not affect auto login features.

### Restore Defaults:
Restores and saves the default settings.

### Test Error Popup:
Throws a popup error. Made for dev purposes, and I'm too lazy to remove from public releases.

### Save and Exit:
Will save the settings to work on next launch, then return to your previous screen. 
> [!NOTE]
> Reloading the application without saving will not save any settings.

# OS Compatability
As of writing this, the application is only built for Windows. We will attempt to make native distrobutions for Linux and MacOS, but will not guarentee anything. All available installers are located inside of both "Current Release" and "Releases," and will be seperated into OS and file when applicable.

# Images:
### The HomeScreen:
<img src="https://files.ashstashp.com/nowPlaying_app/promo/homescreen.png">

### Login Screens:
Subsonic API:

<img src="https://files.ashstashp.com/nowPlaying_app/promo/login-subsonic.png">

Spotify API:

<img src="https://files.ashstashp.com/nowPlaying_app/promo/login-spotify.png">

### Not Playing Screens:
Subsonic API:

<img src="https://files.ashstashp.com/nowPlaying_app/promo/not_playing-subsonic.png">

Spotify API:

<img src="https://files.ashstashp.com/nowPlaying_app/promo/not_playing-spotify.png">

### Currently Playing:
> [!IMPORTANT]
> We, as in ashstashp, do not make own any artwork shown. Nor are we affiliated with their creators. If you are the owner of any artwork displayed, and wish to have it removed, please contact us immediatly.

> [!NOTE]
> We would like to thank CappyDera for allowing us to use images of them using our app. Please visit [CappyDera's Twitch](https://twitch.tv/cappydera) to check out their content!

Subsonic API:

<img src="https://files.ashstashp.com/nowPlaying_app/promo/close-subsonic.png">
<img src="https://files.ashstashp.com/nowPlaying_app/promo/close-subsonic_2.png">
<img src="https://files.ashstashp.com/nowPlaying_app/promo/far-subsonic_1.png">
<img src="https://files.ashstashp.com/nowPlaying_app/promo/far-subsonic_2.png">

Spotify API:

<img src="https://files.ashstashp.com/nowPlaying_app/promo/close-spotify.png">
<img src="https://files.ashstashp.com/nowPlaying_app/promo/close-spotify_dera.png">
<img src="https://files.ashstashp.com/nowPlaying_app/promo/far-spotify_2_dera.png">
<img src="https://files.ashstashp.com/nowPlaying_app/promo/far-spotify_3_dera.png">

## Contact
If you have any issues, please contact us at [contact@ashstashp.com](mailto:contact@ashstashp.com)
>[!IMPORTANT]
>Replies are not guarenteed, and will not originate from this email as of March 2026. The easiest way to get a reply is via our community servers on Discord, Flexer, and more! More information at https://orbital.ashstashp.com.

