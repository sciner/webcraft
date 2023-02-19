import { ArrayHelpers } from "../../www/src/helpers.js";

import mkdirp from 'mkdirp';
import path from 'path';
import fs from 'fs';

// A folder where the music is stored on the server. It's relative to the folder with this source file.
// It's within webcraft dir, but added to .gitignore
const SERVER_MUSIC_DIR = '../../www/media/music/'

// A folder from which the music is automaticlly copied into SERVER_MUSIC_ROOT.
// It's outside the webcraft folder. It's relative to the folder with this source file.
const SERVER_MUSIC_SOURCE_DIR = '../../../music/'

const EMPTY_MUSIC_JSON = {
    "type": "madcraft:music",
    "default": []
}

export class Music_Compiler {

    async run() {
        try {
            // Copy the updated music from an external repo to the place where it's served from. Don't await completion.
            const musicChanged = await this.syncDirectory(SERVER_MUSIC_SOURCE_DIR, SERVER_MUSIC_DIR, (name) => !name.startsWith('.'))
            console.log(musicChanged ? 'The music directory has been updated' : "The music hasn't changed")
        } catch(e) {
            console.error(e);
        }
    }

    /**
     * Copies files from {@link srcDir} to {@link dstDir} if the destination doesn't exist, or is older.
     * Deletes files and directories from {@link dstDir} if they aren't present in {@link srcDir}.
     * Recursively processes subfolders.
     * @return { boolean } true if anything has been changed
     */
    async syncDirectory(srcDir, dstDir, filter = (fileName) => true) {

        srcDir = path.resolve(srcDir)

        if (!fs.existsSync(srcDir)) {
            console.log(`Music directory ${srcDir} not found`)
            // copy empty json for remove 404 http error in Resource loader
            fs.writeFileSync(`${dstDir}/music.json`, JSON.stringify(EMPTY_MUSIC_JSON));
            return false
        }

        async function readdirExt(dir) {
            const files = await fs.promises.readdir(dir) // get filenames
            for(let i = 0; i < files.length; i++) {
                const fullName = path.join(dir, files[i])
                files[i] = {
                    name: files[i],
                    fullName,
                    stat: await fs.promises.stat(fullName)
                }
            }
            return files
        }

        let changed = false
        await mkdirp(dstDir)
        const srcFiles = await readdirExt(srcDir).catch(err => {
            console.error(err)
            throw `Can't read ${srcDir}`
        })
        const dstFiles = await readdirExt(dstDir)
        const srcFilesByName = ArrayHelpers.toObject(srcFiles, (i, v) => v.name)
        const dstFilesByName = ArrayHelpers.toObject(dstFiles, (i, v) => v.name)

        // copy new and/or updated files and directories
        for(const srcFile of srcFiles) {
            if (!filter(srcFile.name)) {
                continue;
            }
            if (srcFile.stat.isDirectory()) {
                // sync subfolder recursively
                const dstFullName = path.join(dstDir, srcFile.name)
                if (await syncDirectory(srcFile.fullName, dstFullName)) {
                    changed = true
                }
            } else {
                // copy the file if the destination is older, or doesn't exist, or isn't a file
                let dstFile = dstFilesByName[srcFile.name]
                if (dstFile?.stat?.isDirectory()) {
                    await fs.promises.rm(dstFile.fullName, { recursive: true })
                    dstFile = null
                    changed = true
                }
                if (!dstFile ||
                    srcFile.stat.ctimeMs > dstFile.stat.ctimeMs ||
                    srcFile.stat.mtimeMs > dstFile.stat.mtimeMs
                ) {
                    const dstFullName = path.join(dstDir, srcFile.name)
                    await fs.promises.copyFile(srcFile.fullName, dstFullName)
                    changed = true
                }
            }
        }

        // delete dst files that don't exist in srcDir
        for(const dstFile of dstFiles) {
            if (!srcFilesByName[dstFile.name]) {
                await fs.promises.rm(dstFile.fullName, { recursive: true })
                changed = true
            }
        }

        return changed
    }

}