import {PIXI} from './pixi.js';

PIXI.settings.PRECISION_VERTEX = PIXI.PRECISION.HIGH;
//PIXI.BatchRenderer.defaultMaxTextures = Math.min(PIXI.BatchRenderer.defaultMaxTextures, 16);

const vertex = `#version 300 es
precision highp float;
precision highp int;
in vec2 aVertexPosition;
in vec2 aSpriteUV;
in vec4 aTextureRegion;
in vec4 aTint;
in float aMultiField;

uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;
uniform vec4 tint;

out vec2 vTextureCoord;
out vec2 vSpriteUV;
out vec4 vTextureRegion;
out vec4 vTint;
out float vMultiField;

void main(void){
    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);

    vSpriteUV = aSpriteUV;
    vTextureCoord = aSpriteUV * aTextureRegion.zw + aTextureRegion.xy;
    vTextureRegion = aTextureRegion;
    vMultiField = aMultiField;
    vTint = aTint * tint;
}
`;

const fragment = `#version 300 es
precision highp float;
precision highp int;
in vec2 vTextureCoord;
in vec2 vSpriteUV;
in vec4 vTextureRegion;
in vec4 vTint;
in float vMultiField;
uniform sampler2D uSamplers[%count%];
uniform float u_time;

out vec4 outColor;

void main() {
    vec4 color;
    
    vec2 textureCoord = clamp(vTextureCoord, vTextureRegion.xy + .5, (vTextureRegion.xy + vTextureRegion.zw) - .5);
    
    int multiField = int(vMultiField + 0.5);
    int textureId = multiField % 32;
    multiField = multiField / 32;
    int tintMode = multiField;
    
    %forloop%
    
    outColor = color * vTint;

    if (tintMode == 1) {
        mat3 m = mat3(-2,-1,2, 3,-2,1, 1,2,2);
        vec2 offset = vSpriteUV - u_time / 8000.;
        vec3 a = vec3( offset * 256.0 / 4e2, (u_time / 2000.) / 4. ) * m,
             b = a * m * .4,
             c1 = b * m * .3;
        vec4 k = vec4(pow(
              min(min(   length(.5 - fract(a)), 
                         length(.5 - fract(b))
                      ), length(.5 - fract(c1)
                 )), 7.) * 25.);
                 
        outColor.rgb += k.rgb * outColor.a * vec3(1.5, 0., 6.);
    }
}
`;

export class MyBatchGeometry extends PIXI.Geometry {
    constructor(_static = false) {
        super();

        this._buffer = new PIXI.Buffer(null, _static, false);

        this._indexBuffer = new PIXI.Buffer(null, _static, true);

        this.addAttribute('aVertexPosition', this._buffer, 2, false, PIXI.TYPES.FLOAT)
            .addAttribute('aSpriteUV', this._buffer, 2, false, PIXI.TYPES.FLOAT)
            .addAttribute('aTextureRegion', this._buffer, 4, false, PIXI.TYPES.FLOAT)
            .addAttribute('aTint', this._buffer, 4, true, PIXI.TYPES.UNSIGNED_BYTE)
            .addAttribute('aMultiField', this._buffer, 1, true, PIXI.TYPES.FLOAT)
            .addIndex(this._indexBuffer);
    }
}

export class MyBatchShaderGenerator extends PIXI.BatchShaderGenerator {
    constructor(vertexSrc, fragTemplate) {
        super(vertexSrc, fragTemplate);
    }
    generateShader(maxTextures)
    {
        let shader = super.generateShader(maxTextures);
        shader.uniforms.u_time = 0;
        return shader;
    }
    generateSampleSrc(maxTextures) {
        let src = '\n\n';
        for (let i = 0; i < maxTextures; i++) {
            if (i > 0) {
                src += '\nelse ';
            }

            if (i < maxTextures - 1) {
                src += `if(textureId == ${i})`;
            }

            src += '\n{';
            src += `\n\tcolor = texture(uSamplers[${i}], textureCoord / vec2(textureSize(uSamplers[${i}], 0)));`;
            src += '\n}';
        }

        src += '\n\n';

        return src;
    }
}

export class MySpriteRenderer extends PIXI.BatchRenderer {
    static extension = {
        name: 'mySprite',
        type: PIXI.ExtensionType.RendererPlugin,
    };

    constructor(renderer) {
        super(renderer)
        this.vertexSize = 11;
        this.geometryClass = MyBatchGeometry;
    }

    setShaderGenerator() {
        this.shaderGenerator = new MyBatchShaderGenerator(vertex, fragment);
    }

    packInterleavedGeometry(element, attributeBuffer, indexBuffer,
                            aIndex, iIndex)
    {
        const {
            uint32View,
            float32View,
        } = attributeBuffer;

        const packedVertices = aIndex / this.vertexSize;
        const uvs = element.uvs;
        const indicies = element.indices;
        const vertexData = element.vertexData;
        const textureId = element._texture.baseTexture._batchLocation;
        const multiField = textureId + 32 * (element.tintMode || 0);
        const frame = element._texture._frame;

        const alpha = Math.min(element.worldAlpha, 1.0);
        const argb = (alpha < 1.0
            && element._texture.baseTexture.alphaMode)
            ? premultiplyTint(element._tintRGB, alpha)
            : element._tintRGB + (alpha * 255 << 24);

        // lets not worry about tint! for now..
        for (let i = 0; i < vertexData.length; i += 2)
        {
            float32View[aIndex++] = vertexData[i];
            float32View[aIndex++] = vertexData[i + 1];
            float32View[aIndex++] = uvs[i];
            float32View[aIndex++] = uvs[i + 1];

            float32View[aIndex++] = frame.x;
            float32View[aIndex++] = frame.y;
            float32View[aIndex++] = frame.width;
            float32View[aIndex++] = frame.height;

            uint32View[aIndex++] = argb;
            float32View[aIndex++] = multiField;
        }

        for (let i = 0; i < indicies.length; i++)
        {
            indexBuffer[iIndex++] = packedVertices + indicies[i];
        }
    }

    start() {
        this._shader.uniforms.u_time = performance.now();
        super.start();
    }
}

export class MySprite extends PIXI.Sprite {
    constructor(texture) {
        super(texture);
        this.pluginName = 'mySprite';
        this.tintMode = 0;
    }

    calculateVertices() {
        const texture = this._texture;
        let textureUp = this._textureID !== texture._updateID;
        super.calculateVertices();
        if (textureUp) {
            this.uvs = PIXI.Texture.WHITE._uvs.uvsFloat32;
        }
    }
}

PIXI.extensions.add(MySpriteRenderer);