export const requestFullScreen = [
  'requestFullscreen',
  'mozRequestFullScreen',
  'webkitRequestFullScreen',
  'msRequestFullscreen',
]
  .map(f => window.document.documentElement[f])
  .find(f => f)
  .bind(window.document.documentElement);

export const cancelFullScreen = [
  'exitFullscreen',
  'mozCancelFullScreen',
  'webkitExitFullscreen',
  'msExitFullscreen',
]
  .map(f => window.document[f])
  .find(f => f)
  .bind(window.document);

export const isFullScreen = () =>
  [
    'fullscreenElement',
    'mozFullScreenElement',
    'webkitFullscreenElement',
    'msFullscreenElement',
  ].some(p => window.document[p]);

export const toggleFullScreen = () => {
  if (isFullScreen()) {
    cancelFullScreen();
  } else {
    requestFullScreen();
  }
};
