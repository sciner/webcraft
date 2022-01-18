import * as jsApi  from "./lib/jsApi";

import { debug } from "./lib/light";

export function sayHello (): void {
    jsApi._asHello(42);
    debug();
}