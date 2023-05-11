import {isMobile} from './isMobileJs.js';
import type {isMobileResult} from "./isMobileLib.js";

export const isMobileJs: isMobileResult = isMobile(globalThis.navigator);
