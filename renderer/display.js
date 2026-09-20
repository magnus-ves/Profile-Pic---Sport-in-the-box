'use strict';

const liveCanvas = document.getElementById('live-canvas');
const liveCtx = liveCanvas.getContext('2d');
const capturedFrame = document.getElementById('captured-frame');
const idleMsg = document.getElementById('idle-msg');
const nameBanner = document.getElementById('name-banner');

const bufferImg = new Image();
let latestCrop = null;
let hideCapturedTimer = null;

function resizeCanvas() {
  liveCanvas.width = window.innerWidth;
  liveCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function drawFrame() {
  if (!bufferImg.naturalWidth) return;

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

  // Rammeoverlegg som viser hvor bildet blir beskåret (viewfinder-ramme)
  if (latestCrop) {
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
}

bufferImg.addEventListener('load', drawFrame);

window.bassengfoto.display.onFrame(({ dataUrl, crop }) => {
  idleMsg.hidden = true;
  liveCanvas.hidden = false;
  latestCrop = crop;
  bufferImg.src = dataUrl;
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
