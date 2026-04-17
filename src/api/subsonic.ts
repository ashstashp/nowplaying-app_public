// src/api/subsonic.ts
import axios from "axios";

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
): Promise<Song> {
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
    const artworkUrl = response.nowPlaying.entry? getCoverArtUrl(baseUrl, id, username, password, version) : "N/A";
    const durationMs = response.nowPlaying.entry? response.nowPlaying.entry[0].duration * 1000 : 0;
    const progressMs = 0;
    const isPlaying = response.nowPlaying.entry? true : false;
    const nowPlaying: Song = {
      id: id, 
      title: title, 
      artist: artist, 
      album: album,
      albumId: "",
      artworkUrl: artworkUrl? artworkUrl : "N/A", 
      durationMs: durationMs, 
      progressMs: progressMs, 
      isPlaying: isPlaying,
      paused: true,
    }
    return nowPlaying;
  } catch (err) {
    console.log(err);
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

export function getSubsonicStreamUrl(baseUrl: string, id: string, username: string, password: string, version: string): string {
  return `${baseUrl}/rest/stream?id=${id}&u=${username}&p=${password}&v=${version}&c=NowPlayingApp`;
}

export function getSubsonicQueue(baseUrl: string, username: string, password: string, version: string) {
  return `${baseUrl}/rest/getPlayQueue?u=${username}&p=${password}&v=${version}&c=NowPlayingApp&f=json`;
}

export async function getPlaylists(
  client: ReturnType<typeof createSubsonicClient>, 
  baseUrl: string, 
  username: string, 
  password: string, 
  version: string): Promise<Array<Playlist>> {
  let playlists: Array<Playlist>;
  playlists = []

  const res = await client.get("/rest/getPlaylists", {
      params: {
        u: username,
        p: password,
        v: version,
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
      "artworkUrl": `${baseUrl}/rest/getCoverArt?id=${response.playlists.playlist[list].id}&u=${username}&p=${password}&v=${version}&c=NowPlayingApp`,
      "songs": []
    };

    const res = await client.get("/rest/getPlaylist", {
      params: {
        id: playlist.id,
        u: username,
        p: password,
        v: version,
        type: "recent",
        size: "500",
        c: "NowPlayingApp",
        f: "json"
      }
    });

    const playlistData = res.data["subsonic-response"];

    for (const i in playlistData.playlist.entry) {
      const song = await getSongInfo(client, baseUrl, username, password, version, playlistData.playlist.entry[i].id);
      playlist.songs.push(song);
    }

    playlists.push(playlist)
  }

  // console.log(playlists[0]);
  return playlists;
}

export async function getAlbums(
  client: ReturnType<typeof createSubsonicClient>, 
  baseUrl: string, 
  username: string, 
  password: string, 
  version: string): Promise<Array<Album>> {
  let albums: Array<Album>;
  albums = []

  const res = await client.get("/rest/getAlbumList", {
      params: {
        u: username,
        p: password,
        v: version,
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
      "artworkUrl": `${baseUrl}/rest/getCoverArt?id=${response.albumList.album[list].id}&u=${username}&p=${password}&v=${version}&c=NowPlayingApp`,
      "songs": []
    };

    const res = await client.get("/rest/getAlbum", {
      params: {
        id: album.id,
        u: username,
        p: password,
        v: version,
        type: "recent",
        size: "500",
        c: "NowPlayingApp",
        f: "json"
      }
    });

    const albumData = res.data["subsonic-response"];

    for (const i in albumData.album.song) {
      const song = await getSongInfo(client, baseUrl, username, password, version, albumData.album.song[i].id);
      album.songs.push(song);
    }

    albums.push(album)
  }

  // console.log(albums[0]);
  return albums;
}

export async function getSongInfo(
  client: ReturnType<typeof createSubsonicClient>, 
  baseUrl: string, 
  username: string, 
  password: string, 
  version: string,
  id: string): Promise<Song> {
    if (id != "") {
      const res = await client.get("/rest/getSong", {
        params: {
          id: id,
          u: username,
          p: password,
          v: version,
          type: "recent",
          size: "500",
          c: "NowPlayingApp",
          f: "json"
        }
      });
    
      const response = res.data["subsonic-response"];

      if (!response || response.status != "ok") {
        throw new Error("Subsonic Fetch Failed");
      }

      const song: Song = {
        "id": id,
        "title": response.song.title,
        "album": response.song.album,
        "albumId": response.song.parent,
        "artist": response.song.artist,
        "artworkUrl": `${baseUrl}/rest/getCoverArt?id=${id}&u=${username}&p=${password}&v=${version}&c=NowPlayingApp`,
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