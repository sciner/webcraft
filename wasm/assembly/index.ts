import * as jsApi  from "./lib/jsApi";

import { debug } from "./lib/constants";

export function sayHello (s: string): void {
    jsApi._asHello('Hello 42');
    debug();
}