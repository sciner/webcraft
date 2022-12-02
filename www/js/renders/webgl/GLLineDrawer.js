import {WebGLLineShader} from "./WebGLLineShader.js";
import {ObjectDrawer} from "../batch/ObjectDrawer.js";

const vertex = `#version 300 es
precision highp float;

uniform mat4 uProjMatrix;
uniform mat4 uViewMatrix;

uniform vec2 u_resolution;
uniform float u_time;

in vec3 aPoint1;
in vec3 aPoint2;
in vec4 aColor;
in float aLineWidth;
in vec2 aQuad;

out vec2 vLine1;
out vec4 vColor;

void main() {
    vec4 screenPos1 = uProjMatrix * uViewMatrix * vec4(aPoint1, 1.0);
    vec4 screenPos2 = uProjMatrix * uViewMatrix * vec4(aPoint2, 1.0);
    vec2 pixelPos1 = (screenPos1.xy / screenPos1.w + 1.0) * 0.5 * u_resolution;
    vec2 pixelPos2 = (screenPos2.xy / screenPos2.w + 1.0) * 0.5 * u_resolution;
    vec2 line = screenPos2.xy - screenPos1.xy;
    vec2 norm = normalize(vec2(-line.y, line.x));
    vec2 pos = (screenPos1.xy + line * aQuad.x) + norm * aQuad.y * (aLineWidth + 1.0);
    
    vLine1 = vec2(aQuad.y, aLineWidth);
    vColor = aColor;
    
    vec2 screenPos = (pos / u_resolution) * 0.5 - 1.0;
    vec2 projPos = mix(screenPos1.wz, screenPos2.wz, aQuad.x);
    gl_Position = vec4(screenPos * projPos.y, projPos);
}
`;

const fragment = `#version 300 es
precision highp float;

in vec2 vLine1;
in vec4 vColor;

out vec4 outColor;

float pixelLine(float x) {
    return clamp(x + 0.5, 0.0, 1.0);
}

void main() {
    float left = pixelLine(-vLine1.y - vLine1.x);
    float right = pixelLine(vLine1.y - vLine1.x);
    float alpha = right - left;
    outColor = vColor * alpha;
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
    }
}
