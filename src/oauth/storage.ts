import { writeTextFile, readTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";

export async function saveTokens(tokens: any, file:string) {
  await writeTextFile(
    "spotify/"+file+".json",
    JSON.stringify(tokens, null, 2),
    { baseDir: BaseDirectory.AppConfig }
  );
}

export async function loadTokens(file: string) {
  try {
    const data = await readTextFile("spotify/"+file+".json", {
      baseDir: BaseDirectory.AppConfig
    });
    return JSON.parse(data);
  } catch {
    return null;
  }
}
