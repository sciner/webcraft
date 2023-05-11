import type { WebGPURenderer } from '../../gpu/WebGPURenderer.js';

export interface ISystem<INIT_OPTIONS = null, DESTROY_OPTIONS = null>
{
    init?: (options?: INIT_OPTIONS) => void;
    /** Generic destroy methods to be overridden by the subclass */
    destroy?: (options?: DESTROY_OPTIONS) => void;
}

export interface ISystemConstructor<R = WebGPURenderer>
{
    new (renderer: R): ISystem;
}
