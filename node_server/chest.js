export class Chest {

    /**
     * Сундук
     * @param {number} user_id Кто автор
     * @param {string} time Время создания, time.Now()
     * @param {Object} item Предмет
     * @param {Object[]} slots Слоты
     */
    constructor(user_id, time, item, slots) {
        this.user_id = user_id;
        this.time = time;
        this.item = item;
        this.slots = slots;
    }

}