let registered = false;
export default function registerAframeComponents(options) {
  if (registered) return;
  registered = true;

  const {
    set_rendered,
    robotChange,

    // Right Controller
    set_controller_object,
    set_trigger_on,
    set_grip_on,
    set_button_a_on,
    set_button_b_on,
    setThumbstickRight,
    setThumbstickDownRight,

    // Left Controller
    set_controller_object_left,
    set_trigger_on_left,
    set_grip_on_left,
    set_button_x_on,
    set_button_y_on,
    setThumbstickLeft,
    setThumbstickDownLeft,

    // Right Hand
    setThumbIndexRight,
    setThumbMiddleRight,
    setIndexMetaRight,
    setMiddleMetaRight,
    setThumbIndexInterRight,

    // HMD
    set_controller_object_cam,

    // Left Hand
    setThumbIndexLeft,
    setThumbMiddleLeft,
    setIndexMetaLeft,
    setMiddleMetaLeft,
    setThumbIndexInterLeft,

    // Menu
    setShowMenu,
    setHmdControl,
    setShowVideo,
    // setControlMode,
    setShowModel,
    setShareControl,
    setWholeBodyControl,

    // Collision Check
    collision,
    setCollision,
    
    // Camera
    setViewCamPose,
    vrModeRef,
    props,
    onXRFrameMQTT,

  } = options;
  
  // set rendered state after a short delay to ensure the scene is ready
  setTimeout(() => set_rendered(true), 100); 

  /* ========================== Robot Model ========================= */
  AFRAME.registerComponent('robot-click', {
    init: function () {
      this.el.addEventListener('click', () => {
        robotChange();
        console.log('robot-click');
      });
    }
  });

  AFRAME.registerComponent('model-opacity', {
    schema: {
      opacity: { type: 'number', default: 0.5 },
    },
    init: function () {
      this.el.addEventListener('model-loaded', this.update.bind(this));
    },
    update: function () {
      var mesh = this.el.getObject3D('mesh');
      var data = this.data;
      if (!mesh) {
        return;
      }
      mesh.traverse(function (node) {
        if (node.isMesh) {
          node.material.opacity = data.opacity;
          node.material.transparent = data.opacity < 1.0;
          node.material.needsUpdate = true;
        }
      });
    },
  });


  /* ========================== VR Controller ========================= */
  AFRAME.registerComponent('vr-controller-right', {
    schema: { type: 'string', default: '' },
    init: function () {
      // Trigger 
      this.el.addEventListener('triggerdown', () => set_trigger_on(true));
      this.el.addEventListener('triggerup', () => set_trigger_on(false));

      // Gripper
      this.el.addEventListener('gripdown', () => set_grip_on(true));
      this.el.addEventListener('gripup', () => set_grip_on(false));

      // A/B
      this.el.addEventListener('abuttondown', () => set_button_a_on(true));
      this.el.addEventListener('abuttonup', () => set_button_a_on(false));
      this.el.addEventListener('bbuttondown', () => set_button_b_on(true));
      this.el.addEventListener('bbuttonup', () => set_button_b_on(false));

      this.el.addEventListener('thumbstickdown', () => setThumbstickDownRight(true));
      this.el.addEventListener('thumbstickmoved', (event) => {
        const { x, y } = event.detail; 
        setThumbstickRight([x, y]);
      });

      set_controller_object(this.el.object3D);

    },
    tick: function () {
      set_controller_object(this.el.object3D);
    }
  });

  AFRAME.registerComponent('vr-controller-left', {
    schema: { type: 'string', default: '' },
    init: function () {
      // Trigger 
      this.el.addEventListener('triggerdown', () => set_trigger_on_left(true));
      this.el.addEventListener('triggerup', () => set_trigger_on_left(false));

      // Gripper
      this.el.addEventListener('gripdown', () => set_grip_on_left(true));
      this.el.addEventListener('gripup', () => set_grip_on_left(false));

      // X/Y
      this.el.addEventListener('xbuttondown', () => set_button_x_on(true));
      this.el.addEventListener('xbuttonup', () => set_button_x_on(false));
      this.el.addEventListener('ybuttondown', () => set_button_y_on(true));
      this.el.addEventListener('ybuttonup', () => set_button_y_on(false));

      this.el.addEventListener('thumbstickdown', () => setThumbstickDownLeft(true));
      this.el.addEventListener('thumbstickmoved', (event) => {
      const { x, y } = event.detail; 
      setThumbstickLeft([x, y]);
      });

      set_controller_object_left(this.el.object3D);
    },
    tick: function () {
      set_controller_object_left(this.el.object3D);
    }
  });


  AFRAME.registerComponent('vr-controller-hmd', {
    init: function () {
      this.hmdProxy = new THREE.Object3D();
    },

    tick: function () {
      const xr = this.el.sceneEl.renderer.xr;
      const frame = this.el.sceneEl.frame;
      
      if (!frame || !xr.enabled) return;

      // 获取参考空间
      const refSpace = xr.getReferenceSpace();
      // 'viewer' 是 WebXR 标准中代表头显的专用名称
      const viewerPose = frame.getViewerPose(refSpace);

      if (viewerPose) {
        // viewerPose 包含多个 view（通常左右眼各一个）
        // 但它的 transform 属性代表了头部的中心位置
        const pose = viewerPose.transform;

        this.hmdProxy.position.set(pose.position.x, pose.position.y, pose.position.z);
        this.hmdProxy.quaternion.set(pose.orientation.x, pose.orientation.y, pose.orientation.z, pose.orientation.w);
        // this.hmdProxy.updateMatrixWorld();

        set_controller_object_cam(this.hmdProxy);
        // console.log('HMD Position:', this.hmdProxy.position);
        // console.log('HMD Rotation:', this.hmdProxy.quaternion);
      }
    }
  });

  // Start animation in VR scene
  AFRAME.registerComponent('scene', {
    init: function () {
      this.el.addEventListener('enter-vr', () => {
        vrModeRef.current = true;
        console.log('enter-vr');

        const xrSession = this.el.renderer.xr.getSession();

        if (xrSession) {
          // --- Request VR FPS ---
          this.optimizeFPS(xrSession);

          if (!props.viewer) {
            xrSession.requestAnimationFrame(onXRFrameMQTT);
          }
        }

        setViewCamPose([0, -0.7, 0.3, 0, 0, 0]);
      });

      this.el.addEventListener('exit-vr', () => {
        vrModeRef.current = false;
        console.log('exit-vr');
      });
    },

    optimizeFPS: function (session) {
      if (session.supportedFrameRates) {
        // Quest 3 FPS [60, 72, 80, 90, 120]. Note: higher fps usually cause overheating and battery drain.
        const targetFPS = 72; 
        
        // Find max supported FPS (if 72 is not supported, fall back to highest available)
        const maxSupported = Math.max(...session.supportedFrameRates);
        const finalTarget = session.supportedFrameRates.includes(targetFPS) ? targetFPS : maxSupported;

        session.updateTargetFrameRate(finalTarget)
          .then(() => {
            console.log(`🚀 FPS Request Success: Target FPS ${finalTarget}Hz (Current FPS: ${session.frameRate}Hz)`);
          })
          .catch((err) => {
            console.warn('❌ FPS Request Failed:', err);
          });
      } else {
        console.log('ℹ️ Current Environment does not support WebXR Frame Rate API');
      }

      const renderer = this.el.renderer;
      const xr = renderer.xr;
      
      const resolutionScale = 1.0; 
      
      if (xr && xr.enabled) {
        const baseLayer = session.renderState.baseLayer;
        if (baseLayer) {
          const currentWidth = baseLayer.framebufferWidth;
          const currentHeight = baseLayer.framebufferHeight;
          
          session.updateRenderState({
            baseLayer: new XRWebGLLayer(session, renderer.getContext(), {
              framebufferScaleFactor: resolutionScale
            })
          });
          
          console.log(`Resolution Scale: ${(resolutionScale * 100).toFixed(0)}% (${currentWidth}x${currentHeight} → ${Math.floor(currentWidth * resolutionScale)}x${Math.floor(currentHeight * resolutionScale)})`);
        }
      }
      
      renderer.setPixelRatio(resolutionScale);
    }
  });


  /* ========================== Collision Check ========================= */
  AFRAME.registerComponent('joint-collision-check', {
    schema: {
      target: { type: 'selector' },
      xPad: { type: 'number', default: 0 },
      yPad: { type: 'number', default: 0 },
      zPad: { type: 'number', default: 0 }
    },

    init: function () {
      if (!this.data.target) {
        console.error('Target not specified or invalid for joint-collision-check component');
        return;
      }

      this.targetEl = this.data.target;
      if (!this.targetEl) {
        console.error(`Target entity not found: ${this.data.target}`);
        return;
      }
    },

    tick: function () {
      const meshA = this.el.getObject3D('mesh');
      const meshB = this.data.target?.getObject3D('mesh');
      if (!meshA || !meshB) return;

      meshA.updateMatrixWorld();
      meshB.updateMatrixWorld();

      const padding = new THREE.Vector3(this.data.xPad, this.data.yPad, this.data.zPad);

      const boxA = new THREE.Box3().setFromObject(meshA).expandByVector(padding);
      const boxB = new THREE.Box3().setFromObject(meshB).expandByVector(padding);

      if (boxA.intersectsBox(boxB)) {
        setCollision(true); 
        console.warn(`🚨 Collision：${this.el.id} and ${this.data.target.id}`);
      } else {
        setCollision(false);
      }
    }
  });

  AFRAME.registerComponent('show-collision-box', {
    schema: {
      xPad: { type: 'number', default: 0 },
      yPad: { type: 'number', default: 0 },
      zPad: { type: 'number', default: 0 },
      color: { type: 'color', default: '#00ff00' },
      opacity: { type: 'number', default: 0.5 } 
    },

    init: function () {
      this.helper = null;

      this.el.addEventListener('model-loaded', () => {
        const mesh = this.el.getObject3D('mesh');
        if (!mesh) return;

        mesh.updateMatrixWorld(true);
        const padding = new THREE.Vector3(this.data.xPad, this.data.yPad, this.data.zPad);
        const box = new THREE.Box3().setFromObject(mesh).expandByVector(padding);

        this.helper = new THREE.Box3Helper(box, new THREE.Color(this.data.color));
        this.helper.material.transparent = true;
        this.helper.material.opacity = this.data.opacity;

        this.el.sceneEl.object3D.add(this.helper);
      });
    },

    tick: function () {
      if (!this.helper) return;
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;

      mesh.updateMatrixWorld(true);
      const padding = new THREE.Vector3(this.data.xPad, this.data.yPad, this.data.zPad);
      const box = new THREE.Box3().setFromObject(mesh).expandByVector(padding);

      this.helper.box.copy(box);
    }
  });

  /* ========================== Stereo Image ========================= */
  AFRAME.registerComponent('stereo-plane', {
    schema: {
      eye: { type: 'string', default: 'left' }, // 'left', 'right', or 'both'
      videoId: { type: 'string', default: '' }  // ID of the <video> element
    },
    init() {
      const videoEl = document.getElementById(this.data.videoId);
      if (!videoEl || videoEl.tagName !== 'VIDEO') {
        console.warn('Video element not found or invalid:', this.data.videoId);
        return;
      }

      this.videoEl = videoEl;
      this.videoEl.setAttribute('crossorigin', 'anonymous');
      this.videoEl.setAttribute('playsinline', 'true');
      this.videoEl.play();

      this.el.setAttribute('material', {
        shader: 'flat',
        src: this.videoEl
      });

      this.el.setAttribute('geometry', {
        primitive: 'plane',
        // width: 2.5,
        // height: 2
      });

      // this.el.setAttribute('position', '0 1.0 0.5');
    },
    update() {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;

      switch (this.data.eye) {
        case 'left':
          mesh.layers.set(1);
          break;
        case 'right':
          mesh.layers.set(2);
          break;
        default:
          mesh.layers.set(0); // both
      }
    }
  });

  AFRAME.registerComponent('stereo-video', {
    schema: {
      eye: { type: 'string', default: 'left' }, // left / right / both
      videoId: { type: 'string' }
    },
    init: function () {
      const videoEl = document.getElementById(this.data.videoId);
      if (!videoEl || videoEl.tagName !== 'VIDEO') {
        console.warn('Video element not found:', this.data.videoId);
        return;
      }

      this.videoEl = videoEl;
      this.videoEl.setAttribute('crossorigin', 'anonymous');
      this.videoEl.setAttribute('playsinline', 'true');
      this.videoEl.play();

      this.el.addEventListener('model-loaded', () => {
        const mesh = this.el.getObject3D('mesh');
        if (!mesh) return;

        mesh.traverse((node) => {
          if (node.isMesh) {
            node.material = new THREE.MeshBasicMaterial({
              map: new THREE.VideoTexture(this.videoEl),
              side: THREE.DoubleSide
            });
          }
        });
      });

      const mesh = this.el.getObject3D('mesh');
      if (mesh) {
        mesh.traverse((node) => {
          if (node.isMesh) {
            node.material = new THREE.MeshBasicMaterial({
              map: new THREE.VideoTexture(this.videoEl),
              side: THREE.DoubleSide
            });
          }
        });
      }
    },
    update: function () {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;

      switch (this.data.eye) {
        case 'left':
          mesh.layers.set(1);
          break;
        case 'right':
          mesh.layers.set(2);
          break;
        default:
          mesh.layers.set(0);
      }
    }
  });

  // ========================== Fisheye Screen Geometry =========================
  // ---------- Newton's iteration method: Given the post-distortion radius r, solve for the incident angle theta. ----------
  function invertFisheyeTheta(r, k1, k2, k3, k4, iterations = 10) {
    let theta = r; // 初始猜测值:畸变较小时 theta ≈ r
    for (let i = 0; i < iterations; i++) {
      const t2 = theta * theta;
      const t4 = t2 * t2;
      const t6 = t4 * t2;
      const t8 = t4 * t4;

      const f = theta * (1 + k1*t2 + k2*t4 + k3*t6 + k4*t8) - r;
      const fPrime = 1 + 3*k1*t2 + 5*k2*t4 + 7*k3*t6 + 9*k4*t8;

      if (Math.abs(fPrime) < 1e-9) break;
      theta -= f / fPrime;
    }
    return theta;
  }

  // ---------- Screen geometry based on distortion calibration parameters. ----------

  // Screen Geometry for Fisheye Camera (e.g., VRCam.02)
  AFRAME.registerGeometry('fisheye-screen', {
    schema: {
      fx: { type: 'number', default: 597.46983283 },
      fy: { type: 'number', default: 596.93842125 },
      cx: { type: 'number', default: 691.10281286 },
      cy: { type: 'number', default: 704.46497326 },
      k1: { type: 'number', default: -0.05007161 },
      k2: { type: 'number', default:  0.00713101 },
      k3: { type: 'number', default: -0.01297023 },
      k4: { type: 'number', default:  0.00511741 },

      texWidth: { type: 'number', default: 1400 },  // single-eye texture width
      texHeight: { type: 'number', default: 1400 }, // single-eye texture height
      eyeOffsetX: { type: 'number', default: 0 },   // left eye 0, right eye 0.5 (UV offset in the entire SBS texture)

      radius: { type: 'number', default: 100 },      // screen distance from the observer
      segmentsWidth: { type: 'number', default: 64 },
      segmentsHeight: { type: 'number', default: 64 },
      maxTheta: { type: 'number', default: 100 },     // Upper limit for incident angle truncation (degrees), to prevent numerical explosion during edge extrapolation.
    },

    init: function (data) {
      const geometry = new THREE.BufferGeometry();
      const positions = [];
      const uvs = [];
      const indices = [];

      const segW = data.segmentsWidth;
      const segH = data.segmentsHeight;
      const maxThetaRad = THREE.MathUtils.degToRad(data.maxTheta);

      for (let iy = 0; iy <= segH; iy++) {
        const py = (iy / segH) * data.texHeight; 

        for (let ix = 0; ix <= segW; ix++) {
          const px = (ix / segW) * data.texWidth; 

          // Pixel coordinates -> Normalized camera coordinates
          const x = (px - data.cx) / data.fx;
          const y = (py - data.cy) / data.fy;
          const r = Math.sqrt(x * x + y * y);
          const phi = Math.atan2(y, x);

          // Newton's iteration method: Invert the incident angle theta, and truncate it to avoid divergence in the image edges (pure black regions).
          let theta = invertFisheyeTheta(r, data.k1, data.k2, data.k3, data.k4);
          theta = Math.min(theta, maxThetaRad);

          // Based on the incident angle and azimuth, place the pixel on the sphere in the corresponding direction (with the observer facing the -Z direction).
          const posX = data.radius * Math.sin(theta) * Math.cos(phi);
          const posY = data.radius * Math.sin(theta) * Math.sin(phi);
          const posZ = -data.radius * Math.cos(theta);

          positions.push(posX, posY, posZ);

          // Linear UV: Directly corresponds to the pixel's position within the texture (offset by `eyeOffsetX` for the left and right eyes).
          const u = data.eyeOffsetX + (px / data.texWidth) * 0.5;
          const v = py / data.texHeight; // If the image is upside down, change to 1.0 - py/data.texHeight
          uvs.push(u, v);
        }
      }

      for (let iy = 0; iy < segH; iy++) {
        for (let ix = 0; ix < segW; ix++) {
          const a = iy * (segW + 1) + ix;
          const b = a + 1;
          const c = a + (segW + 1);
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }

      geometry.setIndex(indices);
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.computeVertexNormals();

      this.geometry = geometry;
    },
  });

  // Screen for Pinhole Camera, (e.g., Zed-mini)
  AFRAME.registerGeometry('pinhole-screen', {
    schema: {
      fx: { type: 'number', default: 788.41415049 },
      fy: { type: 'number', default: 787.3765135 },
      cx: { type: 'number', default: 655.01692926 },
      cy: { type: 'number', default: 357.82862631 },
      k1: { type: 'number', default: -0.3506601 },
      k2: { type: 'number', default: 0.18558038 },
      k3: { type: 'number', default: -0.00065609 },
      p1: { type: 'number', default: 0.00100313 },
      p2: { type: 'number', default: -0.05786136 },

      texWidth: { type: 'number', default: 1280 },  
      texHeight: { type: 'number', default: 720 },  
      eyeOffsetX: { type: 'number', default: 0 },   

      radius: { type: 'number', default: 100 },     
      segmentsWidth: { type: 'number', default: 64 },
      segmentsHeight: { type: 'number', default: 64 },
      fovMargin: { type: 'number', default: 1.0 },  
    },

    init: function (data) {
      const geometry = new THREE.BufferGeometry();
      const positions = [];
      const uvs = [];
      const indices = [];

      const segW = data.segmentsWidth;
      const segH = data.segmentsHeight;

      const xuMin = ((0 - data.cx) / data.fx) * data.fovMargin;
      const xuMax = ((data.texWidth - data.cx) / data.fx) * data.fovMargin;
      const yuMin = ((0 - data.cy) / data.fy) * data.fovMargin;
      const yuMax = ((data.texHeight - data.cy) / data.fy) * data.fovMargin;

      for (let iy = 0; iy <= segH; iy++) {
        const yu = yuMin + (iy / segH) * (yuMax - yuMin);

        for (let ix = 0; ix <= segW; ix++) {
          const xu = xuMin + (ix / segW) * (xuMax - xuMin);

          const r2 = xu * xu + yu * yu;
          const r4 = r2 * r2;
          const r6 = r4 * r2;
          const radial = 1 + data.k1 * r2 + data.k2 * r4 + data.k3 * r6;

          const xd = xu * radial + 2 * data.p1 * xu * yu + data.p2 * (r2 + 2 * xu * xu);
          const yd = yu * radial + data.p1 * (r2 + 2 * yu * yu) + 2 * data.p2 * xu * yu;

          const px = xd * data.fx + data.cx;
          const py = yd * data.fy + data.cy;

          const posX = xu * data.radius;
          const posY = -yu * data.radius; 
          const posZ = -data.radius;

          positions.push(posX, posY, posZ);

          const u = data.eyeOffsetX + THREE.MathUtils.clamp(px / data.texWidth, 0, 1) * 0.5;
          const v = THREE.MathUtils.clamp(py / data.texHeight, 0, 1);
          uvs.push(u, v);
        }
      }

      for (let iy = 0; iy < segH; iy++) {
        for (let ix = 0; ix < segW; ix++) {
          const a = iy * (segW + 1) + ix;
          const b = a + 1;
          const c = a + (segW + 1);
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }

      geometry.setIndex(indices);
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.computeVertexNormals();

      this.geometry = geometry;
    },
  });

  AFRAME.registerComponent('stereo-split', {
    schema: {
      eye: { type: 'string', default: 'left' },
      videoId: { type: 'string', default: '' },

      lensModel: { type: 'string', default: 'fisheye' }, // 'fisheye' | 'pinhole'

      radius: { type: 'number', default: 100 },
      segmentsWidth: { type: 'number', default: 64 },
      segmentsHeight: { type: 'number', default: 64 },

      // 共用内参
      fx: { type: 'number', default: 597.46983283 },
      fy: { type: 'number', default: 596.93842125 },
      cx: { type: 'number', default: 691.10281286 },
      cy: { type: 'number', default: 704.46497326 },

      // fisheye parameters (radial distortion model)
      k1: { type: 'number', default: -0.05007161 },
      k2: { type: 'number', default:  0.00713101 },
      k3: { type: 'number', default: -0.01297023 },
      k4: { type: 'number', default:  0.00511741 },
      maxTheta: { type: 'number', default: 100 },

      // pinhole parameters (radial + tangential distortion model)
      pk1: { type: 'number', default: -0.3506601 },
      pk2: { type: 'number', default: 0.18558038 },
      pk3: { type: 'number', default: -0.00065609 },
      p1: { type: 'number', default: 0.00100313 },
      p2: { type: 'number', default: -0.05786136 },
      fovMargin: { type: 'number', default: 1.0 },

      texWidth: { type: 'number', default: 1920 },
      texHeight: { type: 'number', default: 1920 },
    },

    init: function () {
      const videoEl = document.getElementById(this.data.videoId);
      if (!videoEl || videoEl.tagName !== 'VIDEO') {
        console.warn('Video element not found or invalid:', this.data.videoId);
        return;
      }

      this.videoEl = videoEl;
      this.videoEl.setAttribute('crossorigin', 'anonymous');
      this.videoEl.setAttribute('playsinline', 'true');
      this.videoEl.play();

      const texture = new THREE.VideoTexture(this.videoEl);
      texture.colorSpace = THREE.SRGBColorSpace;
      this.texture = texture;

      this.el.setAttribute('material', {
        shader: 'flat',
        src: texture,
        side: 'back',
      });

      this.updateGeometry();
      this.updateLayer();
    },

    update: function () {
      this.updateGeometry();
      this.updateLayer();
    },

    updateGeometry: function () {
      const data = this.data;
      const eyeOffsetX = this.data.eye === 'right' ? 0.5 : 0.0;

      if (data.lensModel === 'pinhole') {
        this.el.setAttribute('geometry', {
          primitive: 'pinhole-screen',
          radius: data.radius,
          segmentsWidth: data.segmentsWidth,
          segmentsHeight: data.segmentsHeight,
          fx: data.fx,
          fy: data.fy,
          cx: data.cx,
          cy: data.cy,
          k1: data.pk1,
          k2: data.pk2,
          k3: data.pk3,
          p1: data.p1,
          p2: data.p2,
          texWidth: data.texWidth,
          texHeight: data.texHeight,
          eyeOffsetX: eyeOffsetX,
          fovMargin: data.fovMargin,
        });
      } else {
        this.el.setAttribute('geometry', {
          primitive: 'fisheye-screen',
          radius: data.radius,
          segmentsWidth: data.segmentsWidth,
          segmentsHeight: data.segmentsHeight,
          fx: data.fx,
          fy: data.fy,
          cx: data.cx,
          cy: data.cy,
          k1: data.k1,
          k2: data.k2,
          k3: data.k3,
          k4: data.k4,
          texWidth: data.texWidth,
          texHeight: data.texHeight,
          eyeOffsetX: eyeOffsetX,
          maxTheta: data.maxTheta,
        });
      }
    },

    updateLayer: function () {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;

      switch (this.data.eye) {
        case 'left':
          mesh.layers.set(1);
          break;
        case 'right':
          mesh.layers.set(2);
          break;
        default:
          mesh.layers.set(0);
      }
    },
  });

  AFRAME.registerComponent('highlight', {
    init: function () {
      var buttonEls = this.buttonEls = this.el.querySelectorAll('.menu-button');
      var backgroundEl = document.querySelector('#background');
      
      this.groups = [
        ['button1', 'button2'],
        ['button3', 'button4'],
        ['button5', 'button6'],
        ['button7', 'button8'],
        ['button9', 'button10']
      ];
      
      this.dataRecordBtnIds = ['sap-data-start', 'sap-data-stop', 'sap-data-complete'];

      window.menuActiveBtnIds = window.menuActiveBtnIds || ['button1', 'button3', 'button5', 'button8', 'button10'];
      const activeBtnIds = window.menuActiveBtnIds;
      
      this.activeBtns = new Array(this.groups.length).fill(null);

      this.onClick = this.onClick.bind(this);
      this.onMouseEnter = this.onMouseEnter.bind(this);
      this.onMouseLeave = this.onMouseLeave.bind(this);
      this.reset = this.reset.bind(this);

      for (let groupIdx = 0; groupIdx < this.groups.length; ++groupIdx) {
        const btnId = activeBtnIds[groupIdx];
        const el = document.getElementById(btnId);
        if (el) {
          el.setAttribute('material', 'color', '#00ff00');
          this.activeBtns[groupIdx] = el;
        }
      }
      
      for (var i = 0; i < buttonEls.length; ++i) {
        const btn = buttonEls[i];
        if (!activeBtnIds.includes(btn.id) && !this.dataRecordBtnIds.includes(btn.id)) {
          btn.setAttribute('material', 'color', 'white');
        }
        btn.addEventListener('mouseenter', this.onMouseEnter);
        btn.addEventListener('mouseleave', this.onMouseLeave);
        btn.addEventListener('click', this.onClick);
      }
      if (backgroundEl) backgroundEl.addEventListener('click', this.reset);
    },

    getGroupIndex: function (btnId) {
      for (let i = 0; i < this.groups.length; ++i) {
        if (this.groups[i].includes(btnId)) return i;
      }
      return -1;
    },

    onClick: function (evt) {
      const btnId = evt.target.id;
      
      if (this.dataRecordBtnIds.includes(btnId)) return;

      const groupIdx = this.getGroupIndex(btnId);
      if (groupIdx === -1) return;
      
      for (const id of this.groups[groupIdx]) {
        const el = document.getElementById(id);
        if (el) el.setAttribute('material', 'color', 'white');
      }
      evt.target.setAttribute('material', 'color', '#00ff00');
      this.activeBtns[groupIdx] = evt.target;
      window.menuActiveBtnIds[groupIdx] = btnId;
      this.el.addState('clicked');
    },

    onMouseEnter: function (evt) {
      const btnId = evt.target.id;

      if (['sap-data-start', 'sap-data-stop'].includes(btnId)) return;
      
      if (this.dataRecordBtnIds.includes(btnId) && !evt.target.classList.contains('raycastable')) return;

      const groupIdx = this.getGroupIndex(btnId);
      if (groupIdx === -1 || evt.target !== this.activeBtns[groupIdx]) {
        // evt.target.setAttribute('data-pre-hover-color', evt.target.getAttribute('material').color);
        evt.target.setAttribute('material', 'color', '#046de7');
      }
    },

    onMouseLeave: function (evt) {
      const btnId = evt.target.id;

      if (['sap-data-start', 'sap-data-stop'].includes(btnId)) return;
      
      const groupIdx = this.getGroupIndex(btnId);
      
      if (this.dataRecordBtnIds.includes(btnId)) {
        const preColor = evt.target.getAttribute('data-pre-hover-color') || '#333333';
        evt.target.setAttribute('material', 'color', preColor);
        return;
      }

      if (groupIdx === -1) return;
      if (evt.target !== this.activeBtns[groupIdx]) {
        evt.target.setAttribute('material', 'color', 'white');
      }
    },

    reset: function () {
      for (let i = 0; i < this.groups.length; ++i) {
        for (const id of this.groups[i]) {
          const el = document.getElementById(id);
          if (el) el.setAttribute('material', 'color', 'white');
        }
        this.activeBtns[i] = null;
      }
      this.el.removeState('clicked');
    }
  });

  AFRAME.registerComponent('button-action', {
    init: function () {
      const buttonEls = document.querySelectorAll('.menu-button');
      for (let i = 0; i < buttonEls.length; ++i) {
        buttonEls[i].addEventListener('click', (evt) => {
          const btnId = evt.currentTarget.id;
          if (btnId === "button1") { setHmdControl(false); } 
          else if (btnId === "button2") { setHmdControl(true); } 
          else if (btnId === "button3") { setShowVideo(false); } 
          else if (btnId === "button4") { setShowVideo(true); } 
          else if (btnId === "button5") { setShowModel(true); } 
          else if (btnId === "button6") { setShowModel(false); } 
          else if (btnId === "button7") { setShareControl(true); } 
          else if (btnId === "button8") { setShareControl(false); } 
          else if (btnId === "button9") { setWholeBodyControl(true); } 
          else if (btnId === "button10") { setWholeBodyControl(false); } 
        });
      }
    }
  });

  AFRAME.registerComponent('fps-counter', {
    schema: {
      updateInterval: { default: 10 } 
    },

    init: function () {
      this.el.setAttribute('text', {
        align: 'center',
        side: 'double',
        color: 'green',
        value: '-- fps',
        width: 2
      });
      
      this.frameCount = 0;
      this.frameDuration = 0;
      this.currentFPS = 0;
      this.fpsHistory = []; 
      this.maxHistoryLength = 30;
    },

    tick: function (t, dt) {
      this.frameCount++;
      this.frameDuration += dt;

      if (this.frameCount >= this.data.updateInterval) {
        const fps = 1000 / (this.frameDuration / this.frameCount);
        this.currentFPS = fps;

        this.fpsHistory.push(fps);
        if (this.fpsHistory.length > this.maxHistoryLength) {
          this.fpsHistory.shift();
        }
        const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;

        let color = 'green';
        if (avgFPS >= 59.9) { color = 'green'; }
        else if (avgFPS >= 50) { color = 'orange'; }
        else if (avgFPS < 50) { color = 'red'; }

        this.el.setAttribute('text', {
          value: `${avgFPS.toFixed(0)} fps`,
          color: color
        });

        this.frameCount = 0;
        this.frameDuration = 0;
      }
    },

    getFPS: function () {
      return this.currentFPS;
    }
  });

  AFRAME.registerComponent('vr-hand-as-controller', {
    schema: {
      hand: { type: 'string', default: 'right' },
      showMenu: { type: 'boolean', default: false },
    },

    remove: function () {
      if (this.laserLine) {
        this.el.sceneEl.object3D.remove(this.laserLine);
      }
    },

    getJointPose: function(jointName) {
      return this.jointObjects[jointName];
    },

    init: function () {
      this.jointObjects = {
        wrist: new THREE.Object3D(),
        thumbTip: new THREE.Object3D(),
        indexTip: new THREE.Object3D(),
        indexInter: new THREE.Object3D(),
        indexMeta: new THREE.Object3D(),
        middleTip: new THREE.Object3D(),
        middleMeta: new THREE.Object3D(),
        pinkyTip: new THREE.Object3D(),
      };

      this.menuGestureState = {
        isGestureActive: false,      
        gestureStartTime: 0,          
        lastToggleTime: 0,            
        HOLD_DURATION: 600,           
        COOLDOWN_DURATION: 1000,      
      };

      const laserMaterial = new THREE.LineBasicMaterial({ color: '#4CC3D9' });
      const laserGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1)
      ]);
      this.laserLine = new THREE.Line(laserGeometry, laserMaterial);
      this.laserLine.raycast = () => {};
      this.laserLine.visible = false;
      this.el.sceneEl.object3D.add(this.laserLine);

      this.raycaster = new THREE.Raycaster();
      this.wasPinching = false;
      this.currentIntersection = null;

      this.forwardVector = new THREE.Vector3(0, 0, -1);

      this.smoothedWristQuaternion = new THREE.Quaternion();
      this.smoothingInitialized = false;

      this.smoothingFactor = 0.25;
      this.lockedDirectionOnPinch = null;

      const offsetAngleDeg = 10;
      const offsetAngleRad = THREE.MathUtils.degToRad(offsetAngleDeg);
      const sign = -1;
      
      this.laserOffsetQuaternion = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        offsetAngleRad * sign
        );
    },
  
    tick: function () {
      const sceneEl = this.el.sceneEl;
      const frame = sceneEl.frame;
      const renderer = sceneEl.renderer;

      if (!frame || !renderer.xr.enabled) return;

      const session = renderer.xr.getSession();
      if (!session) return;

      const inputSource = Array.from(session.inputSources).find(
        s => s.hand && s.handedness === this.data.hand
      );

      if (inputSource) {
        const refSpace = renderer.xr.getReferenceSpace();
        const hand = inputSource.hand;

        // Get poses for hand joints
        const wristPose = frame.getJointPose(hand.get('wrist'), refSpace);
        const thumbTipPose = frame.getJointPose(hand.get('thumb-tip'), refSpace);
        const indexTipPose = frame.getJointPose(hand.get('index-finger-tip'), refSpace);
        const indexMetaPose = frame.getJointPose(hand.get('index-finger-metacarpal'), refSpace);
        const indexInterPose = frame.getJointPose(hand.get('index-finger-phalanx-intermediate'), refSpace);
        const middleTipPose = frame.getJointPose(hand.get('middle-finger-tip'), refSpace);
        const middleMetaPose = frame.getJointPose(hand.get('middle-finger-metacarpal'), refSpace);
        const pinkyTipPose = frame.getJointPose(hand.get('pinky-finger-tip'), refSpace);

        if (!wristPose || !thumbTipPose || !indexTipPose || !indexMetaPose || !middleTipPose || !middleMetaPose || !pinkyTipPose) {
          return; 
        }

        // Update joint positions and orientations
        const { position: pWrist, orientation: qWrist } = wristPose.transform;
        this.jointObjects.wrist.position.set(pWrist.x, pWrist.y, pWrist.z);
        this.jointObjects.wrist.quaternion.set(qWrist.x, qWrist.y, qWrist.z, qWrist.w);

        const { position: pThumb, orientation: qThumb } = thumbTipPose.transform;
        this.jointObjects.thumbTip.position.set(pThumb.x, pThumb.y, pThumb.z);
        this.jointObjects.thumbTip.quaternion.set(qThumb.x, qThumb.y, qThumb.z, qThumb.w);

        const { position: pIndexTip, orientation: qIndexTip } = indexTipPose.transform;
        this.jointObjects.indexTip.position.set(pIndexTip.x, pIndexTip.y, pIndexTip.z);
        this.jointObjects.indexTip.quaternion.set(qIndexTip.x, qIndexTip.y, qIndexTip.z, qIndexTip.w);

        const { position: pIndexMeta, orientation: qIndexMeta } = indexMetaPose.transform;
        this.jointObjects.indexMeta.position.set(pIndexMeta.x, pIndexMeta.y, pIndexMeta.z);
        this.jointObjects.indexMeta.quaternion.set(qIndexMeta.x, qIndexMeta.y, qIndexMeta.z, qIndexMeta.w);

        const { position: pIndexInter, orientation: qIndexInter } = indexInterPose.transform;
        this.jointObjects.indexInter.position.set(pIndexInter.x, pIndexInter.y, pIndexInter.z);
        this.jointObjects.indexInter.quaternion.set(qIndexInter.x, qIndexInter.y, qIndexInter.z, qIndexInter.w);

        const { position: pMiddleTip, orientation: qMiddleTip } = middleTipPose.transform;
        this.jointObjects.middleTip.position.set(pMiddleTip.x, pMiddleTip.y, pMiddleTip.z);
        this.jointObjects.middleTip.quaternion.set(qMiddleTip.x, qMiddleTip.y, qMiddleTip.z, qMiddleTip.w);

        const { position: pMiddleMeta, orientation: qMiddleMeta } = middleMetaPose.transform;
        this.jointObjects.middleMeta.position.set(pMiddleMeta.x, pMiddleMeta.y, pMiddleMeta.z);
        this.jointObjects.middleMeta.quaternion.set(qMiddleMeta.x, qMiddleMeta.y, qMiddleMeta.z, qMiddleMeta.w);

        const { position: pPinkyTip, orientation: qPinkyTip } = pinkyTipPose.transform;
        this.jointObjects.pinkyTip.position.set(pPinkyTip.x, pPinkyTip.y, pPinkyTip.z);
        this.jointObjects.pinkyTip.quaternion.set(qPinkyTip.x, qPinkyTip.y, qPinkyTip.z, qPinkyTip.w);

        // Retargeting
        const dThumbIndex = this.jointObjects.thumbTip.position.distanceTo(this.jointObjects.indexTip.position);
        const dIndexTipMeta = this.jointObjects.indexTip.position.distanceTo(this.jointObjects.indexMeta.position);

        const dThumbMiddle = this.jointObjects.thumbTip.position.distanceTo(this.jointObjects.middleTip.position);
        const dMiddleTipMeta = this.jointObjects.middleTip.position.distanceTo(this.jointObjects.middleMeta.position);

        const dThumbIndexInter = this.jointObjects.thumbTip.position.distanceTo(this.jointObjects.indexInter.position);
        
        let thumbIndexTipRatio = 0;
        let thumbMiddleRatio = 0;
        let indexMetaRatio = 0;
        let middleMetaRatio = 0;
        let thumbIndexInterRatio = 0;

        if (dThumbIndex < 0.018) {
          thumbIndexTipRatio = 1;
        } else if (dThumbIndex > 0.09) {
          thumbIndexTipRatio = 0;
        } else {
          thumbIndexTipRatio = 1 - (dThumbIndex - 0.018) / (0.09 - 0.018);
        }

        if (dIndexTipMeta < 0.07) {
          indexMetaRatio = 1;
        } else if (dIndexTipMeta > 0.14) {
          indexMetaRatio = 0;
        } else {
          indexMetaRatio = 1 - (dIndexTipMeta - 0.07) / (0.14 - 0.07);
        }

        if (dThumbMiddle < 0.02) {
          thumbMiddleRatio = 1;
        } else if (dThumbMiddle > 0.095) {
          thumbMiddleRatio = 0;
        } else {
          thumbMiddleRatio = 1 - (dThumbMiddle - 0.02) / (0.095 - 0.02);
        }
        
        if (dMiddleTipMeta < 0.07) {
          middleMetaRatio = 1;
        } else if (dMiddleTipMeta > 0.15) {
          middleMetaRatio = 0;
        } else {
          middleMetaRatio = 1 - (dMiddleTipMeta - 0.07) / (0.15 - 0.07);
        }

        if (dThumbIndexInter < 0.010) {
          thumbIndexInterRatio = 1;
        } else if (dThumbIndexInter > 0.10) {
          thumbIndexInterRatio = 0;
        } else {
          thumbIndexInterRatio = 1 - (dThumbIndexInter - 0.010) / (0.10 - 0.010);
        }

        // Hand Trigger
        const angleIndex = this.jointObjects.indexTip.quaternion.angleTo(this.jointObjects.indexMeta.quaternion);
        const angleMiddle = this.jointObjects.middleTip.quaternion.angleTo(this.jointObjects.middleMeta.quaternion);

        const isIndexOpen = angleIndex < 0.5;
        const isMiddleOpen = angleMiddle < 0.5;

        const isTriggered = !(isIndexOpen && isMiddleOpen);

        const dThumbPinky = this.jointObjects.thumbTip.position.distanceTo(this.jointObjects.pinkyTip.position);
        const currentTime = performance.now();
        const state = this.menuGestureState;

        const isGestureDetected = dThumbPinky < 0.028; //m

        if (isGestureDetected) {
          if (!state.isGestureActive) {
            state.isGestureActive = true;
            state.gestureStartTime = currentTime;
          } else {
            const holdDuration = currentTime - state.gestureStartTime;
            const timeSinceLastToggle = currentTime - state.lastToggleTime;
            
            if (holdDuration >= state.HOLD_DURATION && 
                timeSinceLastToggle >= state.COOLDOWN_DURATION &&
                !state.hasTriggered) { 
              
              setShowMenu((prev) => {
                return !prev;
              });
              
              state.lastToggleTime = currentTime;
              state.hasTriggered = true; 
            }
          }
        } else {
          if (state.isGestureActive) {            
            state.isGestureActive = false;
            state.hasTriggered = false;
          }
        }

        // Update
        if (this.data.hand === 'right') {
          set_trigger_on(isTriggered);
          set_controller_object(this.jointObjects.wrist);
          setThumbIndexRight(Math.max(0, Math.min(1, thumbIndexTipRatio)));
          setThumbMiddleRight(Math.max(0, Math.min(1, thumbMiddleRatio)));
          setIndexMetaRight(Math.max(0, Math.min(1, indexMetaRatio)));
          setMiddleMetaRight(Math.max(0, Math.min(1, middleMetaRatio)));
          setThumbIndexInterRight(Math.max(0, Math.min(1, thumbIndexInterRatio)));
        } else {
          set_trigger_on_left(isTriggered);
          set_controller_object_left(this.jointObjects.wrist);
          setThumbIndexLeft(Math.max(0, Math.min(1, thumbIndexTipRatio)));
          setThumbMiddleLeft(Math.max(0, Math.min(1, thumbMiddleRatio)));
          setIndexMetaLeft(Math.max(0, Math.min(1, indexMetaRatio)));
          setMiddleMetaLeft(Math.max(0, Math.min(1, middleMetaRatio)));
          setThumbIndexInterLeft(Math.max(0, Math.min(1, thumbIndexInterRatio)));
        }

        if (!this.data.showMenu) {
          this.laserLine.visible = false;
          this.currentIntersection = null;
          this.wasPinching = false; 
        } else {
          if (!this.smoothingInitialized) {
            this.smoothedWristQuaternion.copy(this.jointObjects.wrist.quaternion);
            this.smoothingInitialized = true;
          } else {
            this.smoothedWristQuaternion.slerp(this.jointObjects.wrist.quaternion, this.smoothingFactor);
          }

          const finalQuaternion = this.smoothedWristQuaternion.clone().multiply(this.laserOffsetQuaternion);

          const direction = this.forwardVector.clone()
            .applyQuaternion(finalQuaternion)
            .normalize();

          const parentOffset = new THREE.Vector3();
          if (this.el.parentEl && this.el.parentEl.object3D) {
            this.el.parentEl.object3D.getWorldPosition(parentOffset);
          }

          const origin = this.jointObjects.wrist.position.clone().add(parentOffset);

          this.laserLine.visible = true;
          this.raycaster.set(origin, direction);
          this.raycaster.far = 10;

          const targets = Array.from(document.querySelectorAll('.raycastable'))
            .map(el => el.object3D)
            .filter(Boolean);

          const intersects = this.raycaster.intersectObjects(targets, true);
          this.currentIntersection = intersects.length > 0 ? intersects[0] : null;

          const endPoint = this.currentIntersection
            ? this.currentIntersection.point
            : origin.clone().add(direction.clone().multiplyScalar(2));

          this.laserLine.geometry.setFromPoints([origin, endPoint]);
          this.laserLine.geometry.attributes.position.needsUpdate = true;

          const isPinching = dThumbIndex < 0.018;
          if (isPinching && !this.wasPinching && this.currentIntersection) {
            this.currentIntersection.object.el.dispatchEvent(new Event('click', { bubbles: true, composed: true }));
          }
          this.wasPinching = isPinching;
        }
      }
    },
  });

  AFRAME.registerComponent('finger-distance-visualizer', {
    schema: {
      hand: { type: 'string', default: 'right' },
      jointA: { type: 'string', default: 'thumbTip' }, // 改为使用 jointObjects 的键名
      jointB: { type: 'string', default: 'indexTip' },
      color: { type: 'string', default: '#00FF00' }
    },

    init: function () {
      this.geometry = new THREE.BufferGeometry();
      this.material = new THREE.LineBasicMaterial({ color: this.data.color, depthTest: false });
      this.line = new THREE.Line(this.geometry, this.material);
      this.el.sceneEl.object3D.add(this.line);

      this.textEl = document.createElement('a-entity');
      this.textEl.setAttribute('text', {
        value: '',
        align: 'center',
        color: this.data.color,
        width: 0.5
      });
      this.el.sceneEl.appendChild(this.textEl);

      this.tempVecA = new THREE.Vector3();
      this.tempVecB = new THREE.Vector3();

      this.handController = null;
    },

    tick: function () {
      if (!this.handController) {
        const handEntities = document.querySelectorAll('[vr-hand-as-controller]');
        for (let i = 0; i < handEntities.length; i++) {
          const handComp = handEntities[i].components['vr-hand-as-controller'];
          if (handComp && handComp.data.hand === this.data.hand) {
            this.handController = handComp;
            break;
          }
        }
        
        if (!this.handController) return;
      }

      const jointA = this.handController.jointObjects[this.data.jointA];
      const jointB = this.handController.jointObjects[this.data.jointB];

      if (jointA && jointB && jointA.position && jointB.position) {
        if (jointA.position.lengthSq() > 0 && jointB.position.lengthSq() > 0) {
          this.tempVecA.copy(jointA.position);
          this.tempVecB.copy(jointB.position);

          this.geometry.setFromPoints([this.tempVecA, this.tempVecB]);
          this.line.visible = true;

          const dist = this.tempVecA.distanceTo(this.tempVecB);
          this.textEl.setAttribute('visible', true);
          this.textEl.object3D.position.lerpVectors(this.tempVecA, this.tempVecB, 0.5);
          this.textEl.object3D.position.y += 0.02; 
          this.textEl.setAttribute('text', 'value', (dist * 100).toFixed(1) + ' cm');
          
          return;
        }
      }
      
      this.line.visible = false;
      this.textEl.setAttribute('visible', false);
    }
    
  });

  AFRAME.registerComponent('finger-angle-visualizer', {
    schema: {
      hand: { type: 'string', default: 'right' },
      jointA: { type: 'string', default: 'indexTip' },
      jointB: { type: 'string', default: 'indexMeta' },
      color: { type: 'string', default: '#FFFF00' }
    },

    init: function () {
      this.textEl = document.createElement('a-entity');
      this.textEl.setAttribute('text', {
        value: '',
        align: 'center',
        color: this.data.color,
        width: 0.3
      });
      this.el.sceneEl.appendChild(this.textEl);

      this.handController = null;
    },

    tick: function () {
      if (!this.handController) {
        const handEntities = document.querySelectorAll('[vr-hand-as-controller]');
        for (let i = 0; i < handEntities.length; i++) {
          const handComp = handEntities[i].components['vr-hand-as-controller'];
          if (handComp && handComp.data.hand === this.data.hand) {
            this.handController = handComp;
            break;
          }
        }
        if (!this.handController) return;
      }

      const jointA = this.handController.jointObjects[this.data.jointA];
      const jointB = this.handController.jointObjects[this.data.jointB];

      if (jointA && jointB && jointA.quaternion && jointB.quaternion) {
        if (jointA.position.lengthSq() > 0 && jointB.position.lengthSq() > 0) {
          const angle = jointA.quaternion.angleTo(jointB.quaternion);
          const angleDegrees = THREE.MathUtils.radToDeg(angle);

          this.textEl.object3D.position.lerpVectors(jointA.position, jointB.position, 0.5);
          this.textEl.object3D.position.y += 0.03;
          this.textEl.setAttribute('text', 'value', `${angleDegrees.toFixed(1)}°`);
          this.textEl.setAttribute('visible', true);
          return;
        }
      }
      
      this.textEl.setAttribute('visible', false);
    }
  });

  /*------------------------------ UI ------------------------------*/
  AFRAME.registerGeometry('rounded-rect', {
    schema: {
      width: {type: 'number', default: 1},
      height: {type: 'number', default: 1},
      radius: {type: 'number', default: 0.05}
    },
    init: function (data) {
      const { width: w, height: h, radius: r } = data;
      const shape = new THREE.Shape();
      const x = -w / 2;
      const y = -h / 2;

      shape.moveTo(x, y + r);
      shape.lineTo(x, y + h - r);
      shape.quadraticCurveTo(x, y + h, x + r, y + h);
      shape.lineTo(x + w - r, y + h);
      shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
      shape.lineTo(x + w, y + r);
      shape.quadraticCurveTo(x + w, y, x + w - r, y);
      shape.lineTo(x + r, y);
      shape.quadraticCurveTo(x, y, x, y + r);

      this.geometry = new THREE.ShapeGeometry(shape);
    }
  });

  AFRAME.registerComponent('rounded-rect-border', {
    schema: {
      width: {type: 'number', default: 1},
      height: {type: 'number', default: 1},
      radius: {type: 'number', default: 0.05},
      color: {type: 'color', default: '#ffffff'},
      opacity: {type: 'number', default: 1}
    },
    init: function () {
      this.buildBorder();
    },
    update: function () {
      this.buildBorder();
    },
    buildBorder: function () {
      const data = this.data;
      const w = data.width, h = data.height, r = Math.min(data.radius, w / 2, h / 2);
      const x = -w / 2, y = -h / 2;

      const shape = new THREE.Shape();
      shape.moveTo(x, y + r);
      shape.lineTo(x, y + h - r);
      shape.quadraticCurveTo(x, y + h, x + r, y + h);
      shape.lineTo(x + w - r, y + h);
      shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
      shape.lineTo(x + w, y + r);
      shape.quadraticCurveTo(x + w, y, x + w - r, y);
      shape.lineTo(x + r, y);
      shape.quadraticCurveTo(x, y, x, y + r);

      const points = shape.getPoints(32); 
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: data.color,
        transparent: data.opacity < 1,
        opacity: data.opacity
      });

      this.el.removeObject3D('border');
      const line = new THREE.LineLoop(geometry, material);
      line.position.z = 0.001; 
      line.raycast = () => {};
      this.el.setObject3D('border', line);
    },
    remove: function () {
      this.el.removeObject3D('border');
    }
  });

}
