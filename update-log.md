# Update Log/Version History

## Beta Versions

### v0.1.3 -- Uh, forgor the date :c - Ashstash
First public release. This version can connect with Spotify and Subsonic API servers.

#### Changes Made
- Spotify Connectivity
- Subsonic API Connectivity

### v0.1.4 -- 03/16/2026? (I FORGOT OKAY T^T) - Ashstash
Released. This version impoves user experience and customization.

#### Changes Made
- Added Logout button
- Added Settings
- Fixed Spotify connection issues (Spotify required authorizing twice. Now requires it once most of the time.)

### v0.1.5 -- 03/16/2026 (Confident in this one) - Ashstash
Released. This version imporves user experience.

#### Changes Made
- Added Keyring Support
    - Allows for saving ONE Spotify client ID
    - Allows for saving ONE set of Subsonic server information (Server URL, Username, and Password)

### v0.1.6 -- 03/16/2026 - Ashstash
Released. This version adds Quality of Life (QOL) features! (they're helpful, but optional incase you wanna disable them... for some reason)

#### Changes Made
- Added Auto Login
    - Users have the ability to Auto Login to their last used provider.
- Added Saved Settings
    - When a user presses the "Exit and Save" button with settings, all settings are saved to the device.
- Longer Spotify Login Time
    - Increased the time it takes to timeout when logging in with Spotify.
- Optimized Stuff
    - At the time of writing this... I kinda forgot what I optimized but I removed some unused functions
- Attempted to remove keyring overide
    - In v0.1.5, keyring overide was always active... I tried to remove it... didn't work...
- Removed previous Linix versions
    - Inproper distrobution caused errors, I'll learn to to build on Linux asap dw!
- Update Log information
    - Old log format:
        - version
            - Details
    - New format version:
        - version -- date - contributer(s)
            - Details
    - Optional Comments (Can add "#### Comments" for extra information on each version)

#### Comments
Added this cause I like to type in big ol' blocks of text! :3 - Ashstash

Anyways, this might actually become the first release if I flush out all the bugs. :p - Ashstash

Also, I'm gonna update the README.md file with better directions that fit the new version. :] - Ashstash


### v0.1.7 -- 03/24/2026 - Ashstash

#### Changes Made
- Fixed Linux Compatability
    - Removed Keyrings from Linux
    - Removed AutoLoigin from Linix
- Added Susonic Version Stroage
- AppImage Release

#### Comments
So uh, the keyring package we utalize is not compatable with Linux... sorry. We'll look into alternatives, but can't guarentee anything.

AppImage is now available, properally. But we're trying to find where to host it so uh, wait please. :3 - Ashstash
The AppImage tar.gz file is available, if you wish to build the AppImage yourself. - Ashstash

### v0.1.8 -- 03/27/2026 - Ashstash

#### Changes Made
- Added Progress Bar
- Fixed AutoLogin Issues (would wait 3 sec for whatever reason)
- Added Theme (color) customization
- Optimized pkce
    - Made Spotify login slightly more consistant
- Added Spotify logo in settings art preview (because spotify requires it, and it wasn't there for whatever reason...)
    - Does not appear when streaming from Subsonic servers, dw.

#### Comments
Sometimes (often) nonexistant errors are thrown. This usually doesn't affect anything. Idk why it happens tho- - Ashstash

I'm thinking about making a NowPlaying+ App. Where you can stream the music from your device. It would also create a mobile app to have controls easier to access. This app would be it's own thing though, to preserve the purpose of this app: to display music you're playing, neatly. - Ashstash

I'll ask around for thoughts on this. It might end up just being a major version to this app. :p - Ashstash

I REALLY need to make a standard commit message ngl. It's rarely been consistant. T^T - Ashstash

I've decided to limit all AppImage downloads to my website. I can't guraentee that the right version is available soooo... yeah. - Ashstash