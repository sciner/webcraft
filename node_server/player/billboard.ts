import { DEMO_PATH } from "@client/constant.js"

declare type IBillboardFile = {
    file: string
    demo: boolean
}

export class Billboard {

    /**
    * Возвращает список файлов игрока (медиа)
    */
    static async getPlayerFiles(session: PlayerSession) : Promise<IBillboardFile[]> {
        const demo = await fs.promises.readdir(DEMO_PATH)
        const files : IBillboardFile[] = []
        for (const file of demo) {
            files.push({ file: file, demo: true })
        }
        const path = `../www/upload/${session.user_id}/`
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
     * @param demo это демо файл или файл игрока
     */
    static getPlayerFile(id: number, file: string, demo: boolean) : boolean | string {
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