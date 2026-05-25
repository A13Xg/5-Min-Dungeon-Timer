const TOTAL_STAGES = 5;
const ROUND_SECONDS = 300;

const timerText = document.getElementById('timerText');
const playPauseButton = document.getElementById('playPauseButton');
const resetButton = document.getElementById('resetButton');
const nextButton = document.getElementById('nextButton');
const backButton = document.getElementById('backButton');
const stageBadge = document.getElementById('stageBadge');
const cardBadge = document.getElementById('cardBadge');
const progressDots = document.getElementById('progressDots');
const menuButton = document.getElementById('menuButton');
const settingsPanel = document.getElementById('settingsPanel');
const musicToggle = document.getElementById('musicToggle');
const beepToggle = document.getElementById('beepToggle');
const wakeToggle = document.getElementById('wakeToggle');
const modeToggle = document.getElementById('modeToggle');
const graphicsToggle = document.getElementById('graphicsToggle');

let stage = 1;
let running = false;
let startTimestamp = null;
let elapsedBeforePause = 0;
let frameId = null;
let wakeLock = null;
let minuteCue = null;
let lastUrgencyBeep = null;
let flashState = false;

let audioCtx;
let ambienceNodes = [];
let ambienceStarted = false;

const particleCanvas = document.getElementById('particles');
const pctx = particleCanvas.getContext('2d');
let particles = [];

function init() {
  createDots();
  render(ROUND_SECONDS, true);
  wireEvents();
  setupParticles();
  animateParticles();
  setTheme(true);
  setGraphics(true);
}

function createDots() {
  progressDots.innerHTML = '';
  for (let i = 1; i <= TOTAL_STAGES; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.dataset.stage = String(i);
    progressDots.appendChild(dot);
  }
}

function wireEvents() {
  playPauseButton.addEventListener('click', toggleTimer);
  resetButton.addEventListener('click', () => resetStage(true));
  nextButton.addEventListener('click', () => jumpStage(1));
  backButton.addEventListener('click', () => jumpStage(-1));

  menuButton.addEventListener('click', () => {
    const open = settingsPanel.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });

  musicToggle.addEventListener('change', () => {
    if (musicToggle.checked) startAmbience();
    else stopAmbience();
  });

  beepToggle.addEventListener('change', () => {
    ensureAudio();
  });

  wakeToggle.addEventListener('change', async () => {
    if (wakeToggle.checked) await requestWakeLock();
    else releaseWakeLock();
  });

  modeToggle.addEventListener('change', () => setTheme(modeToggle.checked));
  graphicsToggle.addEventListener('change', () => setGraphics(graphicsToggle.checked));

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && wakeToggle.checked) {
      await requestWakeLock();
    }
  });

  window.addEventListener('resize', setupParticles);
}

function toggleTimer() {
  if (running) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  ensureAudio();
  if (musicToggle.checked) startAmbience();
  if (wakeToggle.checked) requestWakeLock();
  running = true;
  startTimestamp = performance.now();
  playPauseButton.textContent = 'Pause';
  playPauseButton.setAttribute('aria-label', 'Pause timer');
  tick();
}

function pauseTimer() {
  running = false;
  if (frameId) cancelAnimationFrame(frameId);
  elapsedBeforePause += (performance.now() - startTimestamp) / 1000;
  playPauseButton.textContent = 'Start';
  playPauseButton.setAttribute('aria-label', 'Start timer');
}

function resetStage(playFeedback = false) {
  running = false;
  if (frameId) cancelAnimationFrame(frameId);
  elapsedBeforePause = 0;
  startTimestamp = null;
  minuteCue = null;
  lastUrgencyBeep = null;
  flashState = false;
  playPauseButton.textContent = 'Start';
  playPauseButton.setAttribute('aria-label', 'Start timer');
  render(ROUND_SECONDS, true);
  if (playFeedback && beepToggle.checked) beepSequence(1, 0.045, 560, 0.08);
}

function jumpStage(direction) {
  const target = Math.min(TOTAL_STAGES, Math.max(1, stage + direction));
  if (target === stage) return;
  stage = target;
  resetStage();
}

function tick() {
  if (!running) return;

  const elapsed = elapsedBeforePause + (performance.now() - startTimestamp) / 1000;
  const remaining = Math.max(0, ROUND_SECONDS - elapsed);
  render(remaining);
  handleBeeps(remaining);

  if (remaining <= 0) {
    running = false;
    elapsedBeforePause = ROUND_SECONDS;
    playPauseButton.textContent = 'Start';
    playPauseButton.setAttribute('aria-label', 'Start timer');
    beepSequence(6, 0.05, 240, 0.14);
    return;
  }

  frameId = requestAnimationFrame(tick);
}

function render(remainingSeconds, hardPulse = false) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = Math.floor(remainingSeconds % 60);
  const tenths = Math.floor((remainingSeconds % 1) * 10);
  timerText.textContent = `${minutes}:${String(seconds).padStart(2, '0')}:${tenths}`;

  stageBadge.textContent = `Stage ${stage} / ${TOTAL_STAGES}`;
  cardBadge.textContent = `Dungeon Door Cards: ${15 + stage * 5}`;

  const dots = [...progressDots.children];
  dots.forEach((dot, i) => {
    const pos = i + 1;
    dot.classList.toggle('done', pos < stage);
    dot.classList.toggle('active', pos === stage);
  });

  const color = getColor(remainingSeconds);
  timerText.style.color = color;
  if (remainingSeconds < 60) {
    if (!flashState) timerText.classList.add('flash');
    flashState = true;
  } else if (flashState) {
    timerText.classList.remove('flash');
    flashState = false;
  }

  timerText.classList.add('pulse');
  setTimeout(() => timerText.classList.remove('pulse'), hardPulse ? 150 : 90);
}

function getColor(remaining) {
  if (remaining < 120) return 'var(--danger)';
  if (remaining < 180) return 'var(--warning)';
  if (remaining < 240) return 'var(--teal)';
  return 'var(--accent)';
}

function handleBeeps(remaining) {
  if (!beepToggle.checked) return;
  const whole = Math.floor(remaining);

  if ([240, 180, 120, 60].includes(whole) && minuteCue !== whole) {
    minuteCue = whole;
    beepSequence(whole / 60, 0.08, 370, 0.09);
  }

  const interval = urgencyInterval(remaining);
  if (!interval) return;
  if (lastUrgencyBeep === null || (performance.now() - lastUrgencyBeep) / 1000 >= interval) {
    lastUrgencyBeep = performance.now();
    const freq = remaining < 5 ? 780 : remaining < 15 ? 640 : 520;
    beep(0.025, freq, 0.07);
  }
}

function urgencyInterval(remaining) {
  if (remaining >= 30) return null;
  if (remaining >= 20) return 5;
  if (remaining >= 15) return 3;
  if (remaining >= 10) return 2;
  if (remaining >= 5) return 1;
  if (remaining >= 4) return 0.5;
  if (remaining >= 3) return 0.4;
  if (remaining >= 2) return 0.3;
  if (remaining >= 1) return 0.2;
  return 0.1;
}

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function beep(duration = 0.07, freq = 440, volume = 0.07) {
  ensureAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.start(now);
  osc.stop(now + duration);
}

function beepSequence(count, spacing = 0.09, freq = 360, volume = 0.07) {
  ensureAudio();
  for (let i = 0; i < count; i += 1) {
    const delay = i * spacing * 1000;
    setTimeout(() => beep(0.055, freq + i * 10, volume), delay);
  }
}

function startAmbience() {
  ensureAudio();
  if (ambienceStarted) return;

  const now = audioCtx.currentTime;
  const master = audioCtx.createGain();
  master.gain.value = 0.02;

  const low = audioCtx.createOscillator();
  low.type = 'sawtooth';
  low.frequency.value = 58;

  const high = audioCtx.createOscillator();
  high.type = 'triangle';
  high.frequency.value = 116;

  const noise = audioCtx.createBufferSource();
  const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.18;
  noise.buffer = noiseBuffer;
  noise.loop = true;

  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 420;

  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = 0.1;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 12;
  lfo.connect(lfoGain);
  lfoGain.connect(low.frequency);

  low.connect(master);
  high.connect(master);
  noise.connect(noiseFilter);
  noiseFilter.connect(master);
  master.connect(audioCtx.destination);

  low.start(now);
  high.start(now);
  noise.start(now);
  lfo.start(now);

  ambienceNodes = [master, low, high, noise, lfo, lfoGain, noiseFilter];
  ambienceStarted = true;
}

function stopAmbience() {
  if (!ambienceStarted) return;
  const [master, low, high, noise, lfo] = ambienceNodes;
  const stopAt = audioCtx.currentTime + 0.15;
  master.gain.exponentialRampToValueAtTime(0.0001, stopAt);
  low.stop(stopAt + 0.02);
  high.stop(stopAt + 0.02);
  noise.stop(stopAt + 0.02);
  lfo.stop(stopAt + 0.02);
  ambienceNodes = [];
  ambienceStarted = false;
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    }
  } catch {
    wakeToggle.checked = false;
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

function setTheme(isDark) {
  document.body.classList.toggle('theme-dark', isDark);
  document.body.classList.toggle('theme-light', !isDark);
  modeToggle.checked = isDark;
}

function setGraphics(advanced) {
  document.body.classList.toggle('graphics-advanced', advanced);
  document.body.classList.toggle('graphics-simple', !advanced);
  graphicsToggle.checked = advanced;
}

function setupParticles() {
  const ratio = window.devicePixelRatio || 1;
  particleCanvas.width = window.innerWidth * ratio;
  particleCanvas.height = window.innerHeight * ratio;
  particleCanvas.style.width = `${window.innerWidth}px`;
  particleCanvas.style.height = `${window.innerHeight}px`;
  pctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  particles = Array.from({ length: 38 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    s: Math.random() * 1.8 + 0.6,
    v: Math.random() * 0.35 + 0.08,
  }));
}

function animateParticles() {
  pctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  if (document.body.classList.contains('graphics-advanced')) {
    pctx.fillStyle = 'rgba(244, 205, 143, 0.42)';
    particles.forEach((p) => {
      p.y -= p.v;
      p.x += Math.sin(p.y / 50) * 0.12;
      if (p.y < -5) {
        p.y = window.innerHeight + 5;
        p.x = Math.random() * window.innerWidth;
      }
      pctx.beginPath();
      pctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      pctx.fill();
    });
  }
  requestAnimationFrame(animateParticles);
}

init();
