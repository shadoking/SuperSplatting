function CreateWorker() {
    let workerData = {};
    let gaussians;
    let depthIndex;
    self.onmessage = function(event) {
        if (event.data.gaussians) {
            gaussians = event.data.gaussians;
            gaussians.totalCount = gaussians.count;
            depthIndex = new Uint32Array(gaussians.count);

            console.log(`[Worker] Received ${gaussians.count} gaussians`);

            workerData.positions = new Float32Array(gaussians.count * 3);
            workerData.opacities = new Float32Array(gaussians.count);
            workerData.cov3Da = new Float32Array(gaussians.count * 3);
            workerData.cov3Db = new Float32Array(gaussians.count * 3);
            workerData.colors = new Float32Array(gaussians.count * 3);
        }
        else if (event.data.viewMatrix) {
            const { viewMatrix, maxGaussians } = event.data;

            let start = performance.now();

            gaussians.count = Math.min(gaussians.totalCount, maxGaussians);

            SortGaussiansByDepth(depthIndex, gaussians, viewMatrix);

            for (let i = 0; i < gaussians.count; i++) {
                let j = depthIndex[i];

                workerData.positions[i * 3] = gaussians.positions[j * 3];
                workerData.positions[i * 3 + 1] = gaussians.positions[j * 3 + 1];
                workerData.positions[i * 3 + 2] = gaussians.positions[j * 3 + 2];

                workerData.colors[i * 3] = gaussians.colors[j * 3];
                workerData.colors[i * 3 + 1] = gaussians.colors[j * 3 + 1];
                workerData.colors[i * 3 + 2] = gaussians.colors[j * 3 + 2];

                workerData.opacities[i] = gaussians.opacities[j];

                workerData.cov3Da[i * 3] = gaussians.cov3Ds[j * 6];
                workerData.cov3Da[i * 3 + 1] = gaussians.cov3Ds[j * 6 + 1];
                workerData.cov3Da[i * 3 + 2] = gaussians.cov3Ds[j * 6 + 2];

                workerData.cov3Db[i * 3] = gaussians.cov3Ds[j * 6 + 3];
                workerData.cov3Db[i * 3 + 1] = gaussians.cov3Ds[j * 6 + 4];
                workerData.cov3Db[i * 3 + 2] = gaussians.cov3Ds[j * 6 + 5];
            }

            let sortTime = `${((performance.now() - start)/1000).toFixed(3)}s`;
            console.log(`[Worker] Sorted ${gaussians.count} gaussians in ${sortTime}.`);

            postMessage({
                workerData, sortTime,
            })
        }
    }

    function SortGaussiansByDepth(depthIndex, gaussians, viewMatrix) {
        // 求z轴坐标
        const calcDepth = (i) => gaussians.positions[i*3] * viewMatrix[2] + 
        gaussians.positions[i*3+1] * viewMatrix[6] +
        gaussians.positions[i*3+2] * viewMatrix[10];

        const depths = new Float32Array(gaussians.count);

        for (let i = 0; i < gaussians.count; i++) {
            depthIndex[i] = i;
            depths[i] = calcDepth(i);
        }

        quicksort(depths, depthIndex, 0, gaussians.count - 1);
    }


    function quicksort(A, B, lo, hi) {
        if (lo < hi) {
            const p = partition(A, B, lo, hi) 
            quicksort(A, B, lo, p)
            quicksort(A, B, p + 1, hi) 
        }
    }
    function partition(A, B, lo, hi) {
        const pivot = A[Math.floor((hi - lo)/2) + lo]
        let i = lo - 1 
        let j = hi + 1
    
        while (true) {
            do { i++ } while (A[i] < pivot)
            do { j-- } while (A[j] > pivot)
        
            if (i >= j) return j
            
            let tmp = A[i]; A[i] = A[j]; A[j] = tmp // Swap A
                tmp = B[i]; B[i] = B[j]; B[j] = tmp // Swap B
        }    
    }
}