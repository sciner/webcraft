import type { WebGLRenderer } from './gl/WebGLRenderer.js';
import type { WebGPURenderer } from './gpu/WebGPURenderer.js';

export type Renderer = WebGLRenderer | WebGPURenderer;
