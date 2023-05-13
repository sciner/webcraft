import type { IUniformBlockData } from '../GlProgram.js';

/**
 * returns the uniform block data from the program
 * @private
 * @param program - the webgl program
 * @param gl - the WebGL context
 * @returns {object} the uniform data for this program
 */
export function getUniformBufferData(program: WebGLProgram, gl: WebGL2RenderingContext): Record<string, IUniformBlockData>
{
    const uniformBlocks: Record<string, IUniformBlockData> = {};

    // const totalUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

    const totalUniformsBlocks = gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS);

    for (let i = 0; i < totalUniformsBlocks; i++)
    {
        const name = (gl as any).getActiveUniformBlockName(program, i);
        const uniformBlockIndex = gl.getUniformBlockIndex(program, name);

        const size = gl.getActiveUniformBlockParameter(program, i, gl.UNIFORM_BLOCK_DATA_SIZE);

        uniformBlocks[name] = {
            name,
            index: uniformBlockIndex,
            size,
        };
    }

    return uniformBlocks;
}
