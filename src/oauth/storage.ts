import { writeTextFile, readTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";

const TOKEN_FILE = "spotify/tokens.json";

export async function saveTokens(tokens: any) {
  await writeTextFile(
    TOKEN_FILE,
    JSON.stringify(tokens, null, 2),
    { baseDir: BaseDirectory.AppConfig }
  );
}

export async function loadTokens() {
  try {
    const data = await readTextFile("spotify/tokens.json", {
      baseDir: BaseDirectory.AppConfig
    });
    return JSON.parse(data);
  } catch {
    return null;
  }
}
