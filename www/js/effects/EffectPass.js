export class EffectPass {
    constructor() {
        /**
         * @type { import("../renders/BaseRenderer").BaseRenderTarget }
         */
        this.backDownTarget = null;

        /**
         * @type { import("../renders/BaseRenderer").BaseRenderTarget }
         */
        this.composeTarget = null;

        this.enabled = true;
    }

    /**
     * @type { BaseRenderer }
     */
    init(backend) {
        if (this.backDownTarget) {
            this.backDownTarget.destroy();
        }

        // will downsample to it
        // used for chipper
        this.backDownTarget = backend.createRenderTarget({
            width: backend.size.width >> 2,
            height: backend.size.height >> 2,
            depth: false,
        })
    }

    getTarget() {
        return this.backTarget;
    }

    /**
     * 
     * @param { BaseRenderer } backend 
     */
    resize(backend) {
        this.init(backend);
    }

    /**
     * 
     * @param { BaseRenderer } backend 
     */
    compose (backend, resolveToCanvas = false) {
        if (!this.enabled) {
            if (resolveToCanvas) {
                backend.blitRenderTarget();
            }
            return;
        }
    
        // downscale
        backend.blitActiveTo(this.backDownTarget);

        if (resolveToCanvas) {
            backend.blit(this.backDownTarget, null);

            return;

        } else{

            backend.blit(this.backDownTarget, backend._target);
            return;
        }


        /*
        backend.beginPass();

        this.mesh.draw(backend);

        // resolve
        backend.endPass(true);
        */
    }
}