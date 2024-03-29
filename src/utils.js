async function SetupWebglContext() {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext('webgl2');
    
    const resizeObserver = new ResizeObserver(OnCanvasResize);
    resizeObserver.observe(canvas, {box: 'content-box'});

    const program = CreateProgram(gl, vertexShaderSource, fragmentShaderSource);
               
    const setupAttributeBuffer = (name, components) => {
        const location = gl.getAttribLocation(program, name)
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, components, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(location, 1);
        return buffer
    }

    // Create attribute buffers
    const buffers = {
        center: setupAttributeBuffer('a_center', 3),
        color: setupAttributeBuffer('a_color', 3),
        opacity: setupAttributeBuffer('a_opacity', 1),
        // scale: setupAttributeBuffer('a_scale', 3),
        // rot: setupAttributeBuffer('a_rot', 4),
        covA: setupAttributeBuffer('a_covA', 3),
        covB: setupAttributeBuffer('a_covB', 3),
    }

    gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);

    return { glContext: gl, glProgram: program, buffers }
}

function OnCanvasResize(entries) {
    for (const entry of entries) {
        let width, height;
        let dpr = window.devicePixelRatio;

        if (entry.devicePixelContentBoxSize) {
            width = entry.devicePixelContentBoxSize[0].inlineSize;
            height = entry.devicePixelContentBoxSize[0].blockSize;
            dpr = 1;
        } else if (entry.contentBoxSize) {
            if (entry.contentBoxSize[0]) {
                width = entry.contentBoxSize[0].inlineSize;
                height = entry.contentBoxSize[0].blockSize;
            } else {
                width = entry.contentBoxSize.inlineSize;
                height = entry.contentBoxSize.blockSize;
            }
        } else {
            width = entry.contentRect.width;
            height = entry.contentRect.height;
        }

        canvasSize = [width * dpr, height * dpr];
    }
    
    if (camera != null) { 
         RequestRender();
    }
}

function CreateProgram(gl, vsSource, fsSource) {
    const vertexShader = CreateShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = CreateShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.log("Unable to initialize the shader program: " + gl.getProgramInfoLog(shaderProgram));
        gl.deleteProgram(program);
        return null;
    }
    return shaderProgram;   
}

function CreateShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}