export class PixiGuiPlayer extends VAUX.Container {
    _render(pixiRender) {

        /**
         * 1. When something is drawn, North is TO THE CAMERA, means model X goes left
         * 2. PixiJS container position/scale works fine
         * 3. If you want to bind character body, and not legs - adjust mob_model.drawInGui "mesh.apos.copyFrom(...)"
         */

        const pixiThis = (this as any);

        Qubatch.render.drawFromPixi(pixiRender, pixiThis.worldTransform, 64,
            (qbRender) => {
            for(const player of qbRender.world.players.values()) {
                if(!player.itsMe()) {
                    continue;
                }
                player.drawInGui(qbRender, qbRender.lastDeltaForMeGui);
            }
        });
    }
}