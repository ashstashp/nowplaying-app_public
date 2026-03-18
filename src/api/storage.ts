import { exists, mkdir, BaseDirectory, open, create} from '@tauri-apps/plugin-fs';
// when using `"withGlobalTauri": true`, you may use
// const { exists, BaseDirectory } = window.__TAURI__.fs;

// Check if the `$APPDATA/avatar.png` file exists
// await exists('avatar.png', { baseDir: BaseDirectory.AppData });

async function ensureDir(dirName: string) {
    const dirExists = await exists(dirName, { baseDir: BaseDirectory.AppData });

    if (!dirExists) {
        await mkdir(dirName, { baseDir: BaseDirectory.AppData });
    }
}

async function ensureFile(fileName: string, dirName: string="") {
    ensureDir(dirName);

    if (dirName != "") {
        dirName += "/"
    };

    if (!await exists(dirName+fileName, {baseDir: BaseDirectory.AppData})) {
        await create(dirName+fileName, {baseDir: BaseDirectory.AppData});
    };
}

export async function readFile(fileName: string, dirName: string = "") {
    if (dirName != "") {
        dirName += "/"
    }

    ensureFile(fileName, dirName);

    const file = await open(dirName+fileName, {
        read: true,
        baseDir: BaseDirectory.AppData,
    });
    const stat = await file.stat();
    const buf = new Uint8Array(stat.size);
    await file.read(buf);
    const textContents = new TextDecoder().decode(buf);
    await file.close();
    // console.log(textContents);
    // console.log(typeof(textContents));
    return textContents;
}

export async function writeFile(fileName: string, content: string, dirName: string = "") {
    await ensureDir("");
    await ensureDir(dirName);
    if (dirName != "") {
        dirName += "/"
    }

    const file = await open(dirName+fileName, {
        write: true,
        create: true,
        truncate: true,
        baseDir: BaseDirectory.AppData,
    });
    await file.write(new TextEncoder().encode(content));
    await file.close();
    readFile(fileName, dirName);
}