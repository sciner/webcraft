import {WebGLLineShader} from "./WebGLLineShader.js";
import {ObjectDrawer} from "../batch/ObjectDrawer.js";

const vertex = `#version 300 es
precision highp float;

uniform mat4 uProjMatrix;
uniform mat4 uViewMatrix;
uniform vec3 u_add_pos;

uniform vec2 u_resolution;
uniform float u_time;

in vec3 aPoint1;
in vec3 aPoint2;
in vec4 aColor;
in float aLineWidth;
in vec2 aQuad;

out vec3 vLine1;
out vec4 vColor;

void main() {
    vec4 screenPos1 = uProjMatrix * uViewMatrix * vec4(aPoint1 + u_add_pos, 1.0);
    vec4 screenPos2 = uProjMatrix * uViewMatrix * vec4(aPoint2 + u_add_pos, 1.0);
    
    // culling to frustrum
    float dz = screenPos2.z - screenPos1.z;
    if (abs(dz) > 0.01) {
        float t = (0.0 - screenPos1.z) / dz;
        if (t > 0.0 && t < 1.0) {
            vec4 zeroPoint = (screenPos2 - screenPos1) * t + screenPos1;
            if (screenPos1.z < 0.0) {
                screenPos1 = zeroPoint;
            } else {
                screenPos2 = zeroPoint;
            }
        }
    }
    
    vec2 pixelPos1 = (screenPos1.xy / screenPos1.w + 1.0) * 0.5 * u_resolution;
    vec2 pixelPos2 = (screenPos2.xy / screenPos2.w + 1.0) * 0.5 * u_resolution;
    vec2 line = pixelPos2.xy - pixelPos1.xy;
    vec2 norm = normalize(vec2(-line.y, line.x));
    
    float pixelLineWidth = aLineWidth > 0.0 ? (aLineWidth * u_resolution.y / 100.0) : -aLineWidth;
    pixelLineWidth *= 0.5;
    
    float normOffset = aQuad.y * (pixelLineWidth + 1.0);
    
    vec2 pos = (pixelPos1.xy + line * aQuad.x) + norm * normOffset;
    
    vec2 screenPos = (pos / u_resolution) * 2.0 - 1.0;
    vec2 projPos = mix(screenPos1.zw, screenPos2.zw, aQuad.x);
    gl_Position = vec4(screenPos * projPos.y, projPos);
    
    vLine1 = vec3(normOffset * projPos.y, pixelLineWidth, projPos.y);
    vColor = aColor;
}
`;

const fragment = `#version 300 es
precision highp float;

in vec3 vLine1;
in vec4 vColor;

out vec4 outColor;

float pixelLine(float x) {
    return clamp(x + 0.5, 0.0, 1.0);
}

void main() {
    float dist = vLine1.x / vLine1.z;
    float left = pixelLine(-vLine1.y - dist);
    float right = pixelLine(vLine1.y - dist);
    float alpha = right - left;
    outColor = vec4(vColor.rgb, vColor.a * alpha);
}
`;

/**
 * PixiJS BatchRenderer for chunk array
 */
export class GLLineDrawer extends ObjectDrawer {
    constructor(context) {
        super(context);
    }

    init() {
        this.shader = new WebGLLineShader(this.context, {
            code: {vertex, fragment}
        });
    }

    draw(lineGeom) {
        if (lineGeom.instances === 0) {
            return;
        }
        this.shader.bind();
        lineGeom.bind(this.shader);
        this.shader.updatePos(lineGeom.pos);
        const { gl } = this.context;
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, lineGeom.instances);
    }
}
