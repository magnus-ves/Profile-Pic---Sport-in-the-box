'use strict';

const liveFrame = document.getElementById('live-frame');
const capturedFrame = document.getElementById('captured-frame');
const idleMsg = document.getElementById('idle-msg');
const nameBanner = document.getElementById('name-banner');

let hideCapturedTimer = null;

window.bassengfoto.display.onFrame((dataUrl) => {
  idleMsg.hidden = true;
  liveFrame.hidden = false;
  liveFrame.src = dataUrl;
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
