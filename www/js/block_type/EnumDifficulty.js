export class EnumDifficulty {
    
    static PEACEFUL = 0;
    static EASY = 1;
    static NORMAL = 2;
    static HARD = 3;

    static get(id) {
        return [
            {id:0, title: "peaceful"},
            {id:1, title: "easy"},
            {id:2, title: "normal"},
            {id:3, title: "hard"},
        ];
    }
    
}