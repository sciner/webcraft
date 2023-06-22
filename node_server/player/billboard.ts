import { DEMO_PATH } from "@client/constant.js"

class Billboard {
    /**
    * Возравщает спискок файлов игрока (медиа)
    * @param id id игрока
    */
    static async getPlayerFiles(id: number) {
        const demo = await fs.promises.readdir(DEMO_PATH)
        const files = []
        for (const file of demo) {
            files.push({ file: file, demo: true })
        }
        const path = `../www/upload/${id}/`
        if (fs.existsSync(path)) {
            const upload = await fs.promises.readdir(path)
            for (const file of upload) {
                if (file.indexOf('_') != -1) {
                    files.push({ file: file, demo: false })
                }
            }
        }
        return files
    }
    /**
     * Проверяет принадлежность файла игроку и его наличие
     * @param id id игрока
     * @param file имя файла
     * @param demo это демо фалй или файлы игрока
     * @returns 
     */
    static getPlayerFile(id: number, file: string, demo: boolean) {
        file = file.replace(/\\|\/|\*|\?|/g, '')
        const path = demo ? DEMO_PATH + file : `../www/upload/${id}/${file}`
        try {
            fs.statSync(path)
        } catch (e) {
            return false
        }
        return path
    }
}

export default Billboard