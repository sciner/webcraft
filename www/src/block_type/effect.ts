export class Effect {
    [key: string]: any;
    
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

    static get() {
        return [
            {id: 0, title: "Скорость", icon: 'speed'},
            {id: 1, title: "Замедление", icon: 'slowness'},
            {id: 2, title: "Проворность", icon: 'haste'},
            {id: 3, title: "Усталость", icon: 'mining_fatigue'},
            {id: 4, title: "Сила", icon: 'strength'},
            {id: 5, title: "Слабость", icon: 'weakness'},
            {id: 6, title: "Отравление", icon: 'poison'},
            {id: 7, title: "Регенерация", icon: 'regeneration'},
            {id: 8, title: "Невидимость", icon: 'regeneration'},
            {id: 9, title: "Голод", icon: 'invisibility'},
            {id: 10, title: "Прыгучесть", icon: 'jump_boost'},
            {id: 11, title: "Тошнота", icon: 'nausea'},
            {id: 12, title: "Ночное зрение", icon: 'night_vision'},
            {id: 13, title: "Слепота", icon: 'blindness'},
            {id: 14, title: "Сопротивление", icon: 'resistance'},
            {id: 15, title: "Огнестойкость", icon: 'fire_resistance'},
            {id: 16, title: "Подводное дыхание", icon: 'water_breathing'},
            {id: 17, title: "Иссушение", icon: 'wither'},
            {id: 18, title: "Поглощение", icon: 'absorption'},
            {id: 19, title: "Левитация", icon: 'levitation'},
            {id: 20, title: "Свечение", icon: 'glowing'},
            {id: 21, title: "Удача", icon: 'luck'},
            {id: 22, title: "Неудача", icon: 'unluck'},
            {id: 23, title: "Прилив здоровья", icon: 'health_boost'},
            {id: 24, title: "Исцеление", icon: 'instant_health'},
            {id: 25, title: "Моментальный урон", icon: 'instant_damage'},
        ];
    }
    
}