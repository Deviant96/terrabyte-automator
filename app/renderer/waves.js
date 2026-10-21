'use strict';

(function initAmbientWaves() {
  const wrap = document.getElementById('bg-waves');
  const canvas = document.getElementById('bg-waves-canvas');
  if (!wrap || !canvas) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    depth: true,
    premultipliedAlpha: false,
    powerPreference: 'low-power'
  });
  let program = null;
  let grid = null;
  let uniforms = null;
  let attribUv = -1;
  let raf = 0;
  let start = performance.now();
  let frozenTime = 0;
  let width = 0;
  let height = 0;

  const vsSource = `
    attribute vec2 a_uv;
    uniform float u_time;
    uniform vec2 u_res;
    varying vec3 v_normal;
    varying vec3 v_world;
    varying vec3 v_view;
    varying float v_height;

    vec3 gerstner(vec2 xz, float t) {
      vec3 p = vec3(xz.x, 0.0, xz.y);
      vec2 d;
      float freq, amp, speed, steep, theta, q;

      d = normalize(vec2(1.0, 0.32)); freq = 0.72; amp = 0.22; speed = 1.15; steep = 0.55;
      theta = dot(d, xz) * freq + t * speed; q = steep * amp;
      p.y += amp * sin(theta); p.xz += d * q * cos(theta);

      d = normalize(vec2(-0.55, 1.0)); freq = 1.08; amp = 0.13; speed = 1.45; steep = 0.5;
      theta = dot(d, xz) * freq + t * speed; q = steep * amp;
      p.y += amp * sin(theta); p.xz += d * q * cos(theta);

      d = normalize(vec2(0.28, 0.96)); freq = 1.62; amp = 0.07; speed = 1.85; steep = 0.42;
      theta = dot(d, xz) * freq + t * speed; q = steep * amp;
      p.y += amp * sin(theta); p.xz += d * q * cos(theta);

      d = normalize(vec2(0.92, -0.38)); freq = 0.46; amp = 0.18; speed = 0.72; steep = 0.4;
      theta = dot(d, xz) * freq + t * speed; q = steep * amp;
      p.y += amp * sin(theta); p.xz += d * q * cos(theta);

      d = normalize(vec2(-0.8, 0.6)); freq = 2.15; amp = 0.035; speed = 2.2; steep = 0.35;
      theta = dot(d, xz) * freq + t * speed; q = steep * amp;
      p.y += amp * sin(theta); p.xz += d * q * cos(theta);

      return p;
    }

    vec3 getNormal(vec2 xz, float t) {
      float e = 0.07;
      vec3 c = gerstner(xz, t);
      vec3 dx = gerstner(xz + vec2(e, 0.0), t) - c;
      vec3 dz = gerstner(xz + vec2(0.0, e), t) - c;
      return normalize(cross(dz, dx));
    }

    void main() {
      vec2 xz = vec2((a_uv.x - 0.5) * 9.2, a_uv.y * 11.5 - 1.15);
      float t = u_time;
      vec3 pos = gerstner(xz, t);
      vec3 n = getNormal(xz, t);

      vec3 cam = vec3(sin(t * 0.07) * 0.18, 1.55 + sin(t * 0.21) * 0.06, -2.05);
      vec3 target = vec3(0.0, 0.08, 4.4);
      vec3 forward = normalize(target - cam);
      vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
      vec3 up = cross(right, forward);
      vec3 rel = pos - cam;
      float vx = dot(rel, right);
      float vy = dot(rel, up);
      float vz = dot(rel, forward);

      v_world = pos;
      v_normal = n;
      v_view = cam - pos;
      v_height = pos.y;

      float fov = 1.22;
      float aspect = u_res.x / max(u_res.y, 1.0);
      float near = 0.15;
      float far = 18.0;
      float ndcZ = ((vz - near) / (far - near)) * 2.0 - 1.0;
      gl_Position = vec4(vx * fov / aspect, vy * fov, ndcZ * vz, vz);
    }
  `;

  const fsSource = `
    precision mediump float;
    uniform float u_light;
    varying vec3 v_normal;
    varying vec3 v_world;
    varying vec3 v_view;
    varying float v_height;

    void main() {
      vec3 n = normalize(v_normal);
      vec3 v = normalize(v_view);
      vec3 l = normalize(vec3(-0.42, 0.78, 0.4));
      float ndl = max(dot(n, l), 0.0);
      float spec = pow(max(dot(reflect(-l, n), v), 0.0), 52.0);
      float fres = pow(1.0 - max(dot(n, v), 0.0), 2.6);
      float foam = smoothstep(0.12, 0.26, v_height);

      vec3 deep = mix(vec3(0.16, 0.17, 0.46), vec3(0.55, 0.68, 0.92), u_light);
      vec3 mid = mix(vec3(0.31, 0.48, 0.92), vec3(0.45, 0.78, 0.98), u_light);
      vec3 peak = mix(vec3(0.72, 0.88, 1.0), vec3(0.92, 0.98, 1.0), u_light);
      vec3 col = mix(deep, mid, ndl);
      col = mix(col, peak, foam * 0.7);
      col += spec * mix(vec3(0.75, 0.9, 1.0), vec3(1.0), u_light);
      col += fres * mix(vec3(0.38, 0.55, 0.98), vec3(0.55, 0.7, 0.95), u_light) * 0.42;

      float dist = length(v_world.xz);
      float fog = smoothstep(5.5, 13.0, dist);
      vec3 haze = mix(vec3(0.10, 0.12, 0.28), vec3(0.82, 0.88, 0.97), u_light);
      col = mix(col, haze, fog);

      float alpha = mix(0.58, 0.34, u_light) * (1.0 - fog * 0.55);
      gl_FragColor = vec4(col, alpha);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('[waves]', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function buildProgram() {
    const vs = compile(gl.VERTEX_SHADER, vsSource);
    const fs = compile(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[waves]', gl.getProgramInfoLog(prog));
      return null;
    }
    uniforms = {
      time: gl.getUniformLocation(prog, 'u_time'),
      res: gl.getUniformLocation(prog, 'u_res'),
      light: gl.getUniformLocation(prog, 'u_light')
    };
    attribUv = gl.getAttribLocation(prog, 'a_uv');
    return prog;
  }

  function makeGrid(cols, rows) {
    const verts = new Float32Array((cols + 1) * (rows + 1) * 2);
    let i = 0;
    for (let y = 0; y <= rows; y += 1) {
      for (let x = 0; x <= cols; x += 1) {
        verts[i++] = x / cols;
        verts[i++] = y / rows;
      }
    }
    const idx = new Uint16Array(cols * rows * 6);
    const stride = cols + 1;
    let k = 0;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const a = y * stride + x;
        idx[k++] = a;
        idx[k++] = a + 1;
        idx[k++] = a + stride;
        idx[k++] = a + 1;
        idx[k++] = a + stride + 1;
        idx[k++] = a + stride;
      }
    }
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    return { vbo, ibo, count: idx.length };
  }

  function animationsOn() {
    return !document.body.classList.contains('no-animations') && !reduced.matches;
  }

  function lightMode() {
    return document.body.classList.contains('light-mode') ? 1 : 0;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const nextW = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const nextH = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (nextW === width && nextH === height) return;
    width = nextW;
    height = nextH;
    canvas.width = width;
    canvas.height = height;
    if (gl) gl.viewport(0, 0, width, height);
  }

  function draw2d(time) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const light = lightMode();
    const layers = 14;
    for (let i = 0; i < layers; i += 1) {
      const depth = i / (layers - 1);
      const base = h * (0.38 + depth * 0.5);
      const amp = 8 + (1 - depth) * 28;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) {
        const nx = x / w;
        const y = base
          + Math.sin(nx * 7.2 + time * 1.2 + i * 0.45) * amp
          + Math.sin(nx * 13.4 - time * 1.7 + i) * amp * 0.38
          + Math.sin(nx * 3.1 + time * 0.55 + depth * 2.0) * amp * 0.55;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      const alpha = (light ? 0.08 : 0.16) * (0.35 + depth * 0.65);
      const c = light ? '99, 140, 220' : '99, 120, 245';
      ctx.fillStyle = `rgba(${c},${alpha})`;
      ctx.fill();
    }
  }

  function drawGl(time) {
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform1f(uniforms.time, time);
    gl.uniform2f(uniforms.res, width, height);
    gl.uniform1f(uniforms.light, lightMode());
    gl.bindBuffer(gl.ARRAY_BUFFER, grid.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, grid.ibo);
    gl.enableVertexAttribArray(attribUv);
    gl.vertexAttribPointer(attribUv, 2, gl.FLOAT, false, 0, 0);
    gl.drawElements(gl.TRIANGLES, grid.count, gl.UNSIGNED_SHORT, 0);
  }

  function paint(time) {
    if (gl && program && grid) drawGl(time);
    else if (!gl) draw2d(time);
  }

  function frame(now) {
    resize();
    const t = (now - start) / 1000;
    paint(t);
    if (animationsOn() && !document.hidden) raf = requestAnimationFrame(frame);
    else {
      raf = 0;
      frozenTime = t;
    }
  }

  function play() {
    if (!animationsOn() || document.hidden) {
      stop();
      resize();
      paint(frozenTime);
      return;
    }
    if (raf) return;
    start = performance.now() - frozenTime * 1000;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  if (gl) {
    program = buildProgram();
    if (program) grid = makeGrid(96, 52);
  }

  window.addEventListener('resize', () => {
    resize();
    if (!raf) play();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else play();
  });
  reduced.addEventListener('change', play);
  new MutationObserver(play).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  resize();
  play();
})();
