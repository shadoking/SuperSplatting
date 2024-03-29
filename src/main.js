let gl = null;
let program = null;
let camera = null;
let worker = null;
let canvasSize = [0, 0];

let renderFrameRequest = null;
let renderTimeout = null;

const settings = {
    renderResolution: 1.2,
    maxGaussians: 1e6,
    scalingModifier: 1,
    speed: 0.07,
    sortTime: '0.000s',
    uploadFile: () => document.querySelector('#fileInput').click(),

}

async function main() {
    const { glContext, glProgram, buffers } = await SetupWebglContext();
    gl = glContext;
    program = glProgram;
    
    if (gl == null || program == null) {
        document.querySelector('#loading-text').style.color = `red`
        document.querySelector('#loading-text').textContent = `Could not initialize the WebGL context.`
        throw new Error('Could not initialize WebGL');
    }

    worker = new Worker(URL.createObjectURL(
        new Blob(["(", CreateWorker.toString(), ")(self)"], {
            type: "application/javascript",
        }),
    ));

    worker.onmessage = e => {
        const { workerData, sortTime } = e.data;

        if (getComputedStyle(document.querySelector('#loading-container')).opacity != 0) {
            document.querySelector('#loading-container').style.opacity = 0;
        }

        const updateBuffer = (buffer, data) => {
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        }

        updateBuffer(buffers.color, workerData.colors);
        updateBuffer(buffers.center, workerData.positions);
        updateBuffer(buffers.opacity, workerData.opacities);
        updateBuffer(buffers.covA, workerData.cov3Da);
        updateBuffer(buffers.covB, workerData.cov3Db);

        settings.sortTime = sortTime;

        RequestRender()
    }
    
    InitGUI(settings);
}

async function LoadScene(file) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    document.querySelector('#loading-container').style.opacity = 1;

    let reader = file.stream().getReader();

    let content = await LoadPly(reader, file.size);
    let plyData = await ParsingPly(content.buffer);
    
    worker.postMessage({ gaussians: {
        ...plyData, count: plyData.gaussianCount
    }});

    if (camera == null) {
        camera = new Camera();
    }
    camera.update();

    settings.maxGaussians = Math.min(settings.maxGaussians, plyData.gaussianCount);
}

function RequestRender(...params) {
    if (renderFrameRequest != null) 
        cancelAnimationFrame(renderFrameRequest)

    renderFrameRequest = requestAnimationFrame(() => renderFrame(...params)) 
}

function renderFrame(width, height, res) {

    let resolution = res ?? settings.renderResolution;
    let canvasWidth = width ?? Math.round(canvasSize[0] * resolution);
    let canvasHeight = height ?? Math.round(canvasSize[1] * resolution);

    if (gl.canvas.width != canvasWidth || gl.canvas.height != canvasHeight) {
        gl.canvas.width = canvasWidth;
        gl.canvas.height = canvasHeight;
    }
    
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    camera.update();

    let W = gl.canvas.width;
    let H = gl.canvas.height;
    let tan_fovy = Math.tan(camera.fovy * 0.5);
    let tan_fovx = tan_fovy * W / H;
    let focal_y = H / (2 * tan_fovy);
    let focal_x = W / (2 * tan_fovx);

    gl.uniform1f(gl.getUniformLocation(program, 'W'), W);
    gl.uniform1f(gl.getUniformLocation(program, 'H'), H);
    gl.uniform1f(gl.getUniformLocation(program, 'focal_x'), focal_x);
    gl.uniform1f(gl.getUniformLocation(program, 'focal_y'), focal_y);
    gl.uniform1f(gl.getUniformLocation(program, 'tan_fovx'), tan_fovx);
    gl.uniform1f(gl.getUniformLocation(program, 'tan_fovy'), tan_fovy);
    gl.uniform1f(gl.getUniformLocation(program, 'scale_modifier'), settings.scalingModifier);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'projmatrix'), false, camera.viewProjMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'viewmatrix'), false, camera.viewMatrix);
    // Draw
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, settings.maxGaussians);

    renderFrameRequest = null;
}

main();