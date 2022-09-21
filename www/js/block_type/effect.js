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
    static GLOWING = 20;
    static LUCK = 21;
    static BAD_LUCK = 22;
    static HEALTH_BOOST = 23;
    static INSTANT_HEALTH = 24;
    static INSTANT_DAMAGE = 25;

    static get(id) {
        return [
            {id:0, title: "Скорость"},
            {id:1, title: "Замедление"},
            {id:2, title: "Проворность"},
            {id:3, title: "Усталость"},
            {id:4, title: "Сила"},
            {id:5, title: "Слабость"},
            {id:6, title: "Отравление"},
            {id:7, title: "Регенерация"},
            {id:8, title: "Невидимость"},
            {id:9, title: "Голод"},
            {id:10, title: "Прыгучесть"},
            {id:11, title: "Тошнота"},
            {id:12, title: "Ночное зрение"},
            {id:13, title: "Слепота"},
            {id:14, title: "Сопротивление"},
            {id:15, title: "Огнестойкость"},
            {id:16, title: "Подводное дыхание"},
            {id:17, title: "Иссушение"},
            {id:18, title: "Поглощение"},
            {id:19, title: "Левитация"},
            {id:20, title: "Свечение"},
            {id:21, title: "Удача"},
            {id:22, title: "Неудача"},
            {id:23, title: "Прилив здоровья"},
            {id:24, title: "Исцеление"},
            {id:25, title: "Моментальный урон"},
        ];
    }
    
}