precision mediump float;

attribute vec2 inPos;
varying   vec2 vertPos;
uniform bool u_noDraw;
uniform bool u_noCrosshair;

void main() {
    vertPos     = inPos;
    gl_Position = vec4( inPos, 0.0, 1.0 );
}