//
declare const Qubatch: any // GameClass // | ServerGame
declare const vt: any // GameClass // | ServerGame

//
declare type float = number&{};
declare type int = number&{};
declare type byte = number&{};
declare type imat3 = float[];
declare type imat4 = float[] | Float32Array;

/**
 * A object like Vector
 */
interface IVector {
    x: number;
    y: number;
    z: number;
}

interface TSideSet {}

interface TWorldInfo {}

interface TWorldSettings {}

interface IChatCommand {
    name: int
    data: any,
    time: number,
}

interface Dict<ValueType=any> {
    [key: string]: ValueType
}