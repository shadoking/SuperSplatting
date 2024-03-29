#version 300 es
precision mediump float;

//uniform bool show_depth_map;

in vec3 col;
in float scale_modif;
in float depth;
in vec4 con_o;
in vec2 xy;
in vec2 pixf;

out vec4 fragColor;

vec3 depth_palette(float x) { 
    x = min(1., x);
    return vec3( sin(x*6.28/4.), x*x, mix(sin(x*6.28),x,.6) );
}

void main() {
    vec2 d = xy - pixf;
    float power = -0.5 * (con_o.x * d.x * d.x + con_o.z * d.y * d.y) - con_o.y * d.x * d.y;

    if (power > 0.) {
        discard;
    }

    power *= scale_modif;

    float alpha = min(.99f, con_o.w * exp(power));
    
    vec3 color = col;
    // if (show_depth_map) {
    //     color = depth_palette(depth * .08);
    // }

    if (alpha < 1./255.) {
        discard;
    }

    fragColor = vec4(color * alpha, alpha);
}