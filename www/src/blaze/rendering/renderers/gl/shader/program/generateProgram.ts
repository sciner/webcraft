import { GlProgramData } from '../GlProgramData.js';
import { compileShader } from './compileShader.js';
import { defaultValue } from './defaultValue.js';
import { getAttributeData } from './getAttributeData.js';
import { getUniformBufferData } from './getUniformBufferData.js';
import { getUniformData } from './getUniformData.js';
import { logProgramError } from './logProgramError.js';

import type { GlRenderingContext } from '../../context/GlRenderingContext.js';
import type { GlProgram } from '../GlProgram.js';
import type { IGLUniformData } from '../GlProgramData.js';

/**
 * generates a WebGL Program object from a high level Pixi Program.
 * @param gl - a rendering context on which to generate the program
 * @param program - the high level Pixi Program.
 */
export function generateProgram(gl: GlRenderingContext, program: GlProgram): GlProgramData
{
    const glVertShader = compileShader(gl, gl.VERTEX_SHADER, program.vertex);
    const glFragShader = compileShader(gl, gl.FRAGMENT_SHADER, program.fragment);

    const webGLProgram = gl.createProgram();

    gl.attachShader(webGLProgram, glVertShader);
    gl.attachShader(webGLProgram, glFragShader);

    const transformFeedbackVaryings = program.extra?.transformFeedbackVaryings;

    if (transformFeedbackVaryings)
    {
        if (typeof gl.transformFeedbackVaryings !== 'function')
        {
            // #if _DEBUG
            console.warn(`TransformFeedback is not supported but TransformFeedbackVaryings are given.`);
            // #endif
        }
        else
        {
            gl.transformFeedbackVaryings(
                webGLProgram,
                transformFeedbackVaryings.names,
                transformFeedbackVaryings.bufferMode === 'separate'
                    ? gl.SEPARATE_ATTRIBS
                    : gl.INTERLEAVED_ATTRIBS
            );
        }
    }

    gl.linkProgram(webGLProgram);

    if (!gl.getProgramParameter(webGLProgram, gl.LINK_STATUS))
    {
        logProgramError(gl, webGLProgram, glVertShader, glFragShader);
    }

    program.attributeData = getAttributeData(webGLProgram, gl);
    program.uniformData = getUniformData(webGLProgram, gl);
    program.uniformBlockData = getUniformBufferData(webGLProgram, gl);

    gl.deleteShader(glVertShader);
    gl.deleteShader(glFragShader);

    const uniformData: {[key: string]: IGLUniformData} = {};

    for (const i in program.uniformData)
    {
        const data = program.uniformData[i];

        uniformData[i] = {
            location: gl.getUniformLocation(webGLProgram, i),
            value: defaultValue(data.type, data.size),
        };
    }

    const glProgram = new GlProgramData(webGLProgram, uniformData);

    return glProgram;
}
