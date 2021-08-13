//@ts-check
export default class WebGPURenderer {
    
}

/**
 * 
 * @param {HTMLCanvasElement} view 
 */
WebGPURenderer.test = function(view, options = {}) {
    const context = navigator.gpu && view.getContext('webgpu');

    if (context) {
        context.dispose();
        return true;
    }

    return false;
}

WebGPURenderer.kind = 'webgpu';