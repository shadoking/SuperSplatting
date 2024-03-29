const { mat4, vec3, vec4 } = glMatrix;

class Camera {
    constructor(target = [0, 0, 0], up = [0, 1, 0], camera = []) {
        // 摄像机朝向
        this.target = [...target];
        // 摄像机上方向
        this.up = [...up];

        this.theta  = camera[0] ?? -Math.PI / 2;
        this.phi    = camera[1] ?? Math.PI / 2;
        this.radius = camera[2] ?? 3;

        // 摄像机位置
        this.pos = vec3.create();
        this.front = vec3.create();
        this.right = vec3.create();

        // 垂直视角
        this.fovy = Math.PI / 4;

        // 视图矩阵
        this.viewMatrix = mat4.create();
        // 投影矩阵
        this.projMatrix = mat4.create();
        this.viewProjMatrix = mat4.create();
        this.lastViewProjMatrix = mat4.create();
        // 旋转矩阵
        this.rotaMatrix = rotateAlign(this.up, [0, 1, 0]);

        this.workerUpdate = true;

        this.keyStates = {
            KeyW: false,
            KeyS: false,
            KeyA: false,
            KeyD: false,
            KeyR: false,
            KeyF: false,
        }

        document.addEventListener('keydown', e => {
            if (this.keyStates[e.code] == null) {
                return;
            }
            this.keyStates[e.code] = true;
        });

        document.addEventListener('keyup', e => {
            if (this.keyStates[e.code] == null) {
                return;
            }
            this.keyStates[e.code] = false;
        });

        gl.canvas.addEventListener('mousemove', e => {
            if (!e.buttons) {
                return;
            }
            this.theta -= e.movementX * 0.01 * .5;
            this.phi += e.movementY * 0.01 * .5;

            RequestRender();
        });

        gl.canvas.addEventListener('wheel', e => {
            this.radius = Math.max(0.01, this.radius + e.deltaY * 0.01);

            RequestRender();
        })

        setInterval(this.updateKeys.bind(this), 1000 / 60);
    }

    updateKeys() {
        if (Object.values(this.keyStates).every(s => !s)) {
            return;
        }

        let front = this.getFront();
        let right = vec3.cross(this.right, front, this.up);
        if (this.keyStates.KeyW) {
            vec3.add(this.target, this.target, vec3.scale(front, front, settings.speed));
        }
        if (this.keyStates.KeyS) {
            vec3.subtract(this.target, this.target, vec3.scale(front, front, settings.speed));
        }
        if (this.keyStates.KeyA) {
            vec3.add(this.target, this.target, vec3.scale(right, right, settings.speed));
        }
        if (this.keyStates.KeyD) {
            vec3.subtract(this.target, this.target, vec3.scale(right, right, settings.speed));
        }
        if (this.keyStates.KeyR) {
            vec3.subtract(this.target, this.target, vec3.scale(vec3.create(), this.up, settings.speed));
        }
        if (this.keyStates.KeyF) {
            vec3.add(this.target, this.target, vec3.scale(vec3.create(), this.up, settings.speed));
        }

        RequestRender();
    }

    update() {
        vec3.add(this.pos, this.target, this.getPos(this.radius));

        mat4.lookAt(this.viewMatrix, this.pos, this.target, this.up);

        let aspect = gl.canvas.width / gl.canvas.height;
        mat4.perspective(this.projMatrix, this.fovy, aspect, 0.1, 100);

        mat4.multiply(this.viewProjMatrix, this.projMatrix, this.viewMatrix);

        invertRow(this.viewMatrix, 1);
        invertRow(this.viewMatrix, 2);
        invertRow(this.viewProjMatrix, 1);

        invertRow(this.viewMatrix, 0);
        invertRow(this.viewProjMatrix, 0);
        
        this.updateWorker();
    }

    updateWorker() {
        let dot = this.lastViewProjMatrix[2]  * this.viewProjMatrix[2] 
                  + this.lastViewProjMatrix[6]  * this.viewProjMatrix[6]
                  + this.lastViewProjMatrix[10] * this.viewProjMatrix[10]
        if (Math.abs(dot - 1) > 0.01) {
            this.workerUpdate = true;
            mat4.copy(this.lastViewProjMatrix, this.viewProjMatrix);
            
        }
         if (this.workerUpdate) {
            this.workerUpdate = false;
            worker.postMessage({
                viewMatrix:  this.viewProjMatrix, 
                maxGaussians: settings.maxGaussians,
            });
        }
    }

    getPos(radius = this.radius) {
        const pos = [
            radius * Math.sin(this.phi) * Math.cos(this.theta), // x
            radius * Math.cos(this.phi),                        // z
            radius * Math.sin(this.phi) * Math.sin(this.theta)  // y
        ];

        return vec3.transformMat3(pos, pos, this.rotaMatrix);
    }

    getFront() {
        let front = vec3.subtract(this.front, [0,0,0], this.getPos());
        vec3.normalize(front, front);
        return front;
    }
}

const invertRow = (mat, row) => {
    mat[row + 0] = -mat[row + 0];
    mat[row + 4] = -mat[row + 4];
    mat[row + 8] = -mat[row + 8];
    mat[row + 12] = -mat[row + 12];
}

// vec3.transformMat3(v1, v2, result)
// 方向一致，但长度会变
function rotateAlign(v1, v2) {
    // cross(v1, v2)
    const axis = [
      v1[1] * v2[2] - v1[2] * v2[1],
      v1[2] * v2[0] - v1[0] * v2[2],
      v1[0] * v2[1] - v1[1] * v2[0]
    ];
    // dot(v1, v2)
    const cosA = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    const k = 1.0 / (1.0 + cosA);
  
    const result = [
      (axis[0] * axis[0] * k) + cosA, (axis[1] * axis[0] * k) - axis[2], (axis[2] * axis[0] * k) + axis[1],
      (axis[0] * axis[1] * k) + axis[2], (axis[1] * axis[1] * k) + cosA, (axis[2] * axis[1] * k) - axis[0],
      (axis[0] * axis[2] * k) - axis[1], (axis[1] * axis[2] * k) + axis[0], (axis[2] * axis[2] * k) + cosA
    ];
  
    return result;
}
