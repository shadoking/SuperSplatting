const { mat3 } = glMatrix

function ComputeCov3D(scale, mod, rot) {
    let S = mat3.create();
    S[0] = mod * scale[0];
    S[4] = mod * scale[1];
    S[8] = mod * scale[2];
    
    let R = mat3.create();
    let r = rot[0];
    let x = rot[1];
    let y = rot[2];
    let z = rot[3];
    
    mat3.set(R,
        1. - 2. * (y * y + z * z), 2. * (x * y - r * z), 2. * (x * z + r * y),
        2. * (x * y + r * z), 1. - 2. * (x * x + z * z), 2. * (y * z - r * x),
        2. * (x * z - r * y), 2. * (y * z + r * x), 1. - 2. * (x * x + y * y)
        );
    
    let M = mat3.create();
    mat3.multiply(M, S, R);

    let Sigma = mat3.create();
    let MT = mat3.create();

    mat3.transpose(MT, M);
    mat3.multiply(Sigma, MT, M);

    // store upper right
    const cov3D = [
        Sigma[0], Sigma[1], Sigma[2],
        Sigma[4], Sigma[5], Sigma[8]
    ]

    return cov3D
}

function ParsingPly(fileContent) {
    const SH_C0 = 0.28209479177387814;
    const sigmoid = (m) => 1 / (1 + Math.exp(-m));
    
    let start = performance.now();

    let content = new TextDecoder('utf-8').decode(fileContent.slice(0, 2000));   
    let headerEndIndex = content.indexOf('end_header');
    let headerContent = content.slice(0, headerEndIndex);

    const regex = /element vertex (\d+)/;
    const match = headerContent.match(regex);
    let gaussianCount = parseInt(match[1]);

    document.querySelector('#loading-text').textContent = `Success. Initializing ${gaussianCount} gaussians...`;

    let positions = [];
    let opacities = [];
    let colors = [];
    let cov3Ds = [];
    
    const NUM_PROPS = 62;
    const view = new DataView(fileContent);

    let contentStartIndex = headerEndIndex + 'end_header'.length + 1;
    const fromDataView = (splatIndex, start, end) => {
        const startOffset = contentStartIndex + splatIndex * NUM_PROPS * 4 + start * 4

        if (end == null) 
            return view.getFloat32(startOffset, true)

        return new Float32Array(end - start).map((_, i) => view.getFloat32(startOffset + i * 4, true))
    }

    const extractSplatData = (splatID) => {
        const position = fromDataView(splatID, 0, 3);
        // const n = fromDataView(splatID, 3, 6) //法线，不使用
        const harmonic = fromDataView(splatID, 6, 9);
        
        const H_END = 6 + 48;
        const opacity = fromDataView(splatID, H_END);
        const scale = fromDataView(splatID, H_END + 1, H_END + 4);
        const rotation = fromDataView(splatID, H_END + 4, H_END + 8);
    
        return { position, harmonic, opacity, scale, rotation }
    }

    for (let i = 0; i < gaussianCount ; i++) {
        let { position, harmonic, opacity, scale, rotation } = extractSplatData(i);

        // Normalize quaternion
        let magnitude = 0;
        for(let j = 0; j < 4; j++) {
            magnitude += rotation[j] * rotation[j];
        }
        magnitude = Math.sqrt(magnitude);
        rotation = rotation.map(v => v / magnitude);

        // Exponentiate scale
        scale = scale.map(v => Math.exp(v));

        // Activate alpha
        opacity = sigmoid(opacity);

        let color = [
            0.5 + SH_C0 * harmonic[0],
            0.5 + SH_C0 * harmonic[1],
            0.5 + SH_C0 * harmonic[2]
        ];
        
        let cov3D = ComputeCov3D(scale, 1, rotation);

        positions.push(...position);
        opacities.push(opacity);
        colors.push(...color);
        cov3Ds.push(...cov3D);
    }

    console.log(`Loaded ${gaussianCount} gaussians in ${((performance.now() - start)/1000).toFixed(3)}s`);

    return { positions, opacities, colors, cov3Ds, gaussianCount }
}

async function LoadPly(reader, contentLength) {
    return new Promise(async (resolve, reject) => {        
        const buffer = new Uint8Array(contentLength);
        let downloadedBytes = 0;

        const readNextChunk = async () => {
            const { value, done } = await reader.read();

            if (!done) {
                downloadedBytes += value.byteLength;
                buffer.set(value, downloadedBytes - value.byteLength);

                const progress = (downloadedBytes / contentLength) * 100;
                document.querySelector('#loading-bar').style.width = progress + '%';
                document.querySelector('#loading-text').textContent = `Loading 3D scene... ${progress.toFixed(2)}%`;

                readNextChunk();
            }
            else {
                resolve(buffer);
            }
        }

        readNextChunk();
    })
}

