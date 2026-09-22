'use strict';

const liveCanvas = document.getElementById('live-canvas');
const liveCtx = liveCanvas.getContext('2d');
const localVideo = document.getElementById('local-video');
const capturedFrame = document.getElementById('captured-frame');
const overlayFrame = document.getElementById('overlay-frame');
const idleMsg = document.getElementById('idle-msg');
const nameBanner = document.getElementById('name-banner');

const bufferImg = new Image();
let latestCrop = null;
let hideCapturedTimer = null;

let latestChromaKey = { enabled: false, keyColor: { r: 0, g: 177, b: 64 }, tolerance: 40, feather: 12 };
let currentDeviceId = null;
let lastAttemptedDeviceId = undefined; // skiller seg fra enhver ekte deviceId eller null
let usingLocalCamera = false;
let localStream = null;
let cameraAttemptInFlight = false;

const chromaBgEl = new Image();
chromaBgEl.src = 'assets/display-chroma-bg.png';
let chromaBgCanvas = null;

function resizeCanvas() {
  liveCanvas.width = window.innerWidth;
  liveCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function drawCropGuide(dx, dy, dw, dh) {
  if (!latestCrop) return;
  const size = latestCrop.size * Math.min(dw, dh);
  const cx = dx + latestCrop.cx * dw;
  const cy = dy + latestCrop.cy * dh;

  liveCtx.save();
  liveCtx.beginPath();
  liveCtx.rect(dx, dy, dw, dh);
  liveCtx.rect(cx - size / 2, cy - size / 2, size, size);
  liveCtx.clip('evenodd');
  liveCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  liveCtx.fillRect(dx, dy, dw, dh);
  liveCtx.restore();

  liveCtx.strokeStyle = '#2ecc71';
  liveCtx.lineWidth = 3;
  liveCtx.strokeRect(cx - size / 2, cy - size / 2, size, size);
}

// ---------------------------------------------------------------------------
// Fallback-visning: mottatte JPEG-bilder over IPC (brukes kun hvis direkte
// kameratilgang i dette vinduet ikke lyktes).
// ---------------------------------------------------------------------------
function drawFrame() {
  if (usingLocalCamera || !bufferImg.naturalWidth) return;

  const cw = liveCanvas.width;
  const ch = liveCanvas.height;
  liveCtx.clearRect(0, 0, cw, ch);
  liveCtx.fillStyle = '#000';
  liveCtx.fillRect(0, 0, cw, ch);

  const iw = bufferImg.naturalWidth;
  const ih = bufferImg.naturalHeight;
  const scale = Math.min(cw / iw, ch / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;

  liveCtx.drawImage(bufferImg, dx, dy, dw, dh);
  drawCropGuide(dx, dy, dw, dh);
}

bufferImg.addEventListener('load', drawFrame);

window.bassengfoto.display.onFrame(({ dataUrl, crop }) => {
  if (usingLocalCamera) return; // direkte kamera kjører allerede, ignorer reserveløsning
  idleMsg.hidden = true;
  liveCanvas.hidden = false;
  latestCrop = crop;
  bufferImg.src = dataUrl;
});

// ---------------------------------------------------------------------------
// Direkte kameratilgang i dette vinduet — ingen forsinkelse fra IPC/JPEG.
// ---------------------------------------------------------------------------
async function startLocalCamera(deviceId) {
  if (cameraAttemptInFlight) return;
  cameraAttemptInFlight = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
      audio: false
    });
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    localStream = stream;
    localVideo.srcObject = stream;
    await localVideo.play().catch(() => {});
    usingLocalCamera = true;
    currentDeviceId = deviceId;
    idleMsg.hidden = true;
    liveCanvas.hidden = false;
    requestAnimationFrame(renderLocalFrame);
  } catch (err) {
    console.warn('Kunne ikke åpne kamera direkte i visningsvinduet, bruker reservevisning:', err.message);
    usingLocalCamera = false;
  } finally {
    cameraAttemptInFlight = false;
  }
}

function renderLocalFrame() {
  if (!usingLocalCamera) return;

  if (localVideo.readyState >= 2 && localVideo.videoWidth > 0) {
    const cw = liveCanvas.width;
    const ch = liveCanvas.height;
    const iw = localVideo.videoWidth;
    const ih = localVideo.videoHeight;
    const scale = Math.min(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    liveCtx.clearRect(0, 0, cw, ch);
    liveCtx.fillStyle = '#000';
    liveCtx.fillRect(0, 0, cw, ch);
    liveCtx.drawImage(localVideo, dx, dy, dw, dh);

    if (latestChromaKey.enabled && chromaBgEl.complete && chromaBgEl.naturalWidth) {
      const w = Math.round(dw);
      const h = Math.round(dh);
      if (!chromaBgCanvas) chromaBgCanvas = document.createElement('canvas');
      if (chromaBgCanvas.width !== w || chromaBgCanvas.height !== h) {
        chromaBgCanvas.width = w;
        chromaBgCanvas.height = h;
        const bgCtx = chromaBgCanvas.getContext('2d');
        bgCtx.drawImage(chromaBgEl, 0, 0, w, h);
      }
      const bgCtx = chromaBgCanvas.getContext('2d');
      const bgImageData = bgCtx.getImageData(0, 0, w, h);
      const liveImageData = liveCtx.getImageData(dx, dy, w, h);
      compositeChromaOntoBackground(liveImageData, bgImageData, latestChromaKey.keyColor, latestChromaKey.tolerance, latestChromaKey.feather);
      liveCtx.putImageData(liveImageData, dx, dy);
    }

    drawCropGuide(dx, dy, dw, dh);
  }

  requestAnimationFrame(renderLocalFrame);
}

window.bassengfoto.display.onCameraConfig(({ deviceId, crop, chromaKey }) => {
  latestCrop = crop || latestCrop;
  if (chromaKey) latestChromaKey = chromaKey;

  // Prøv å åpne kameraet direkte kun én gang per valgt kamera-ID — cameraConfig
  // sendes ofte (f.eks. for hver pikselbevegelse ved dragging av beskjæringsrammen),
  // så uten denne sperren ville et mislykket forsøk (kameraet opptatt et annet sted)
  // spamme nye getUserMedia-kall kontinuerlig og gjøre vinduet ustabilt.
  if (deviceId !== lastAttemptedDeviceId) {
    lastAttemptedDeviceId = deviceId;
    startLocalCamera(deviceId);
  }
});

window.bassengfoto.display.onOverlay((dataUrl) => {
  if (!dataUrl) {
    overlayFrame.hidden = true;
    overlayFrame.src = '';
    return;
  }
  overlayFrame.src = dataUrl;
  overlayFrame.hidden = false;
});

window.bassengfoto.display.onCaptured(({ dataUrl, athleteName }) => {
  capturedFrame.src = dataUrl;
  capturedFrame.classList.add('show');

  if (athleteName) {
    nameBanner.textContent = athleteName;
    nameBanner.classList.add('show');
  }

  if (hideCapturedTimer) clearTimeout(hideCapturedTimer);
  hideCapturedTimer = setTimeout(() => {
    capturedFrame.classList.remove('show');
    nameBanner.classList.remove('show');
  }, 3500);
});

document.addEventListener('dblclick', () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen().catch(() => {});
  }
});
