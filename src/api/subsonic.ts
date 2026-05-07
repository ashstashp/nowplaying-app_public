// Made by Ashstashp

import axios from "axios";

import fallback from "../assets/icons/musical-note-outline.svg";

export class Subsonic implements Player {
    // Client Info
    user: string = "";
    pass: string = "";
    url: string = "";
    version: string = "1.16.1";
    client = null;
    volume = 100;
    repeat: boolean = false;

    // Now Playing & Not Playing
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

    // Queue and Library Info
    queue: Array<string> = [];
    playlists: Array<Playlist> = [];
    albums: Array<Album> = [];

    constructor(user: string, pass: string, url: string, version: string) {
      this.user = user;
      this.pass = pass;
      this.url = url;
      this.version = version
      this.client = this.createSubsonicClient(url);
    };

    /////////////////////////////////
    ///////// Create Client /////////
    /////////////////////////////////
    createSubsonicClient(baseUrl: string) {
      try {
        return axios.create({
          baseURL: baseUrl,
          timeout: 5000
        });
      } catch(e) {
        return new Error(e);
      }
    }

    /////////////////////////////////
    /////////// Get Url's ///////////
    /////////////////////////////////
    getCoverArtUrl(id: string): string {
      return `${this.url}/rest/getCoverArt?id=${id}&u=${this.user}&p=${this.pass}&v=${this.version}&c=NowPlayingApp`;
    }

    getSubsonicStreamUrl(id: string): string {
      return `${this.url}/rest/stream?id=${id}&u=${this.user}&p=${this.pass}&v=${this.version}&c=NowPlayingApp`;
    }


    //////////////////////////////////
    ///// Get Playlists & Albums /////
    //////////////////////////////////
    async loadPlaylists() {
      const res = await this.client.get("/rest/getPlaylists", {
          params: {
            u: this.user,
            p: this.pass,
            v: this.version,
            c: "NowPlayingApp",
            f: "json"
          }
        });

      const response = res.data["subsonic-response"];

      if (!response || response.status != "ok") {
        throw(new Error("Subsonic Fetch Failed"))
      };

      for (const list in response.playlists.playlist) {
        // console.log(response.playlists[list][0].id)
        // console.log(list)
        const playlist:Playlist = {
          "id": response.playlists.playlist[list].id,
          "title": response.playlists.playlist[list].name,
          "comment": response.playlists.playlist[list].comment,
          "artworkUrl": `${this.url}/rest/getCoverArt?id=${response.playlists.playlist[list].id}&u=${this.user}&p=${this.pass}&v=${this.version}&c=NowPlayingApp`,
          "songs": []
        };

        const res = await this.client.get("/rest/getPlaylist", {
          params: {
            id: playlist.id,
            u: this.user,
            p: this.pass,
            v: this.version,
            type: "recent",
            size: "500",
            c: "NowPlayingApp",
            f: "json"
          }
        });

        const playlistData = res.data["subsonic-response"];

        for (const i in playlistData.playlist.entry) {
          const song = await this.getSongInfo(playlistData.playlist.entry[i].id);
          playlist.songs.push(song);
        }

        this.playlists = [...this.playlists, playlist];
      }
      // console.log(this.playlists);
    }

    async loadAlbums() {

      const res = await this.client.get("/rest/getAlbumList", {
          params: {
            u: this.user,
            p: this.pass,
            v: this.version,
            type: "recent",
            size: "500",
            c: "NowPlayingApp",
            f: "json"
          }
        });

      const response = res.data["subsonic-response"];

      if (!response || response.status != "ok") {
        throw(new Error("Subsonic Fetch Failed"))
      };

      for (const list in response.albumList.album) {
        // console.log(response.playlists[list][0].id)
        const album:Album = {
          "id": response.albumList.album[list].id,
          "title": response.albumList.album[list].name,
          "artist": response.albumList.album[list].artist,
          "artworkUrl": `${this.url}/rest/getCoverArt?id=${response.albumList.album[list].id}&u=${this.user}&p=${this.pass}&v=${this.version}&c=NowPlayingApp`,
          "songs": []
        };

        const res = await this.client.get("/rest/getAlbum", {
          params: {
            id: album.id,
            u: this.user,
            p: this.pass,
            v: this.version,
            type: "recent",
            size: "500",
            c: "NowPlayingApp",
            f: "json"
          }
        });

        const albumData = res.data["subsonic-response"];

        for (const i in albumData.album.song) {
          const song = await this.getSongInfo(albumData.album.song[i].id);
          album.songs.push(song);
        }

        this.albums = [...this.albums, album];
      }
      // console.log(this.albums);
    }

    /////////////////////////////////
    /////////// Song Info ///////////
    /////////////////////////////////

    async getSongInfo(id: string): Promise<Song> {
        if (id != "") {
          const res = await this.client.get("/rest/getSong", {
            params: {
              id: id,
              u: this.user,
              p: this.pass,
              v: this.version,
              type: "recent",
              size: "500",
              c: "NowPlayingApp",
              f: "json"
            }
          });
        
          const response = await res.data["subsonic-response"];

          // console.log("SONG-INFO RESPONSE: ");
          // console.log(response);

          if (!response || response.status != "ok") {
            throw new Error("Subsonic Fetch Failed");
          }

          const song: Song = {
            "id": id,
            "title": response.song.title,
            "album": response.song.album,
            "albumId": response.song.parent,
            "artist": response.song.artist,
            "artworkUrl": `${this.url}/rest/getCoverArt?id=${id}&u=${this.user}&p=${this.pass}&v=${this.version}&c=NowPlayingApp`,
            "durationMs": response.song.duration * 1000,
            "progressMs": 0,
            "isPlaying": false,
            "paused": true,
          }
          

          // console.log(response);
          
          return song;
        } else {
          const song: Song = {
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

          return song;
        }
    }

    /////////////////////////////////
    ////////// Audio Stuff //////////
    /////////////////////////////////

    stream = new Audio();
    duration = 0;


    //////////////////////////////////
    ///////// Queue Controls /////////
    //////////////////////////////////

    makeQueue(list: Playlist | Album) {
      for (const song in list.songs) {
        // console.log(list.songs[song].title);
        this.queue = [...this.queue, list.songs[song].id];
      }
    }

    clearQueue() {
      this.queue = [];
    }

    shuffleQueue() {
      const shuffled = this.queue.sort(() => Math.random() - 0.5);
      this.queue = shuffled;
    }
    
    
    /////////////////////////////////
    /////// Playback Controls ///////
    /////////////////////////////////

    togglePause() {
      this.nowPlaying.paused = !this.nowPlaying.paused;
    }

    toggleRepeat() {
      this.repeat = !this.repeat
      console.log(this.repeat);
    }

    nextSong() {
      this.nowPlaying.progressMs = this.nowPlaying.durationMs;
      this.stream.currentTime = 0;
      this.stream.pause()
      let index = 0;

      try{
        if (this.nowPlaying.id != "") index = this.queue.indexOf(this.nowPlaying.id) + 1;
        console.log(index);
        console.log(this.queue.length)
        console.log(index >= this.queue.length);
        if (this.repeat && index >= this.queue.length || index == 0 || !index) index = 0;
        // console.log(this.queue[index]);
        this.play(this.queue[index]);
      } catch(e) {
        this.nowPlaying = this.notPlaying;
        console.log(e);
      }
    }

    prevSong() {
      try {
        if (this.nowPlaying.id != "" && this.queue.indexOf(this.nowPlaying.id) != 0) {
          this.play(this.queue[this.queue.indexOf(this.nowPlaying.id) - 1])
        } else if (this.queue.indexOf(this.nowPlaying.id) == 0) {
          this.play(this.queue[this.queue.length - 1])
        } else {
        }
      } catch (e) {
        console.log(e);
      }
    }

    pause() {
      this.stream.pause()
      this.togglePause();
    }

    async unload() {
      this.pause();
      this.stream.src = "";
      this.nowPlaying = await this.getSongInfo("");
    }

    resume() {
      this.stream.play()
      this.nowPlaying.paused = false;
    }

    async play(id: string) {
      try {
        this.stream.pause()
        let url = `${this.url}/rest/stream?id=${id}&u=${this.user}&p=${this.pass}&v=${this.version}&c=NowPlayingApp`;
        this.nowPlaying = await this.getSongInfo(id);
        console.log(this.nowPlaying);
        this.nowPlaying.paused = false;
        this.nowPlaying.isPlaying = true;

        this.stream.addEventListener("loadedmetadata", () => {
          this.duration = this.stream.duration;
        });

        this.stream.addEventListener("timeupdate", () => {
          this.nowPlaying.progressMs = this.stream.currentTime * 1000;
        });

        // console.log(nowPlaying);
        // console.log(url)
        this.stream.src = url;
        this.stream.play();
      } catch(e) {
        console.log(e);
        this.nowPlaying = this.notPlaying;
      }
    }

    seek(time: number) {
      this.nowPlaying.progressMs = time;
      this.stream.currentTime = this.nowPlaying.progressMs / 1000;
    }

    setVolume(vol: number) {
      this.volume = vol;
      console.log(this.volume);
      this.stream.volume = this.volume/100;
      console.log(this.stream.volume);
    }
}

export interface Player {
  nowPlaying: Song;
  albums: Array<Album>;
  playlists: Array<Playlist>;
  volume: number;
  queue: Array<string>;
  repeat: boolean;
  loadPlaylists(): void;
  loadAlbums(): void;
  makeQueue(list: Playlist | Album): void;
  shuffleQueue(): void;
  clearQueue(): void;
  play(id: string): void;
  pause(): void;
  resume(): void;
  prevSong(): void;
  nextSong(): void;
  unload(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  toggleRepeat() : void;
  stream?: ReturnType<typeof Audio>
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumId: string;
  artworkUrl: string;
  durationMs: number,
  progressMs: number,
  isPlaying: boolean,
  paused: boolean
}

export interface Playlist {
  id: string,
  title: string,
  comment: string,
  artworkUrl: string,
  songs: Array<Song>,
}

export interface Album {
  id: string,
  title: string,
  artist: string,
  artworkUrl: string,
  songs: Array<Song>
}

export function getSubsonicQueue(baseUrl: string, username: string, password: string, version: string) {
  return `${baseUrl}/rest/getPlayQueue?u=${username}&p=${password}&v=${version}&c=NowPlayingApp&f=json`;
}

// Made by Ashstashp