//@ts-check
export default class WebGLRenderer {
    
}

/**
 * 
 * @param {HTMLCanvasElement} view 
 */
WebGLRenderer.test = function(view, options = {}) {
    /**
     * @type {*}
     */
    const context = view.getContext('webgl2', options);
    
    if (context) {
        context.getExtension('WEBGL_lose_context').loseContext();
        return true;
    }

    return false;
}

WebGLRenderer.kind = 'webgl';