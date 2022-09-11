export class Effect {
    static SPEED = 0;
    static SLOWNESS = 1;
    static HASTE = 2;
    static MINING_FATIGUE = 3;
    static STRENGTH = 4;
    static WEAKNESS = 5;
    static POISON = 6;
    static REGENERATION = 7;
    static INVISIBILITY = 8;
    static HUNGER = 9;
    static JUMP_BOOST = 10;
    static NAUSEA = 11;
    static NIGHT_VISION = 12;
    static BLINDNESS = 13;
    static RESISTANCE = 14;
    static FIRE_RESISTANCE = 15;
    static RESPIRATION = 16;
    static WITHER = 17;
    static ABSORPTION = 18;
    static LEVITIATION = 19;
    
    static get(id) {
        return [
            {id:0, negative: false, title: "Скорость"},
            {id:1, negative: true, title: "Замедление"},
            {id:2, negative: false, title: "Проворность"},
            {id:3, negative: true, title: "Усталость"},
            {id:4, negative: false, title: "Сила"},
            {id:5, negative: true, title: "Слабость"},
            {id:6, negative: true, title: "Отравление"},
            {id:7, negative: false, title: "Регенерация"},
            {id:8, negative: false, title: "Невидимость"},
            {id:9, negative: true, title: "Голод"},
            {id:10, negative: false, title: "Прыгучесть"},
            {id:11, negative: true, title: "Тошнота"},
            {id:12, negative: false, title: "Ночное зрение"},
            {id:13, negative: true, title: "Слепота"},
            {id:14, negative: false, title: "Сопротивление"},
            {id:15, negative: false, title: "Огнестойкость"},
            {id:16, negative: false, title: "Подводное дыхание"},
            {id:17, negative: true, title: "Иссушение"},
            {id:18, negative: false, title: "Поглощение"},
            {id:19, negative: true, title: "Левитация"},
        ];
    }
}