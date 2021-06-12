// @ts-ignore
import * as PIXI from 'https://cdn.skypack.dev/pixi.js@^6.0.2?min';
// @ts-ignore
import { from, fromEvent, merge, Subject } from 'https://cdn.skypack.dev/rxjs@^6.6.7?min';
import {
  debounceTime,
  first,
  switchMap,
  filter,
  map,
  mergeMap,
  tap,
  // @ts-ignore
} from 'https://cdn.skypack.dev/rxjs@^6.6.7/operators?min';

const fromQueryString = q =>
  q
    .slice(1)
    .split('&')
    .map(p => p.split('=').map(decodeURIComponent))
    .reduce((o, [key, value]) => {
      const p = o[key];
      if (p !== undefined) {
        Array.isArray(p) ? p.push(value) : (o[key] = [p, value]);
      } else {
        o[key] = value;
      }
      return o;
    }, {});

const requestFullScreen = [
  'requestFullscreen',
  'mozRequestFullScreen',
  'webkitRequestFullScreen',
  'msRequestFullscreen',
]
  .map(f => window.document.documentElement[f])
  .find(f => f)
  .bind(window.document.documentElement);
const cancelFullScreen = [
  'exitFullscreen',
  'mozCancelFullScreen',
  'webkitExitFullscreen',
  'msExitFullscreen',
]
  .map(f => window.document[f])
  .find(f => f)
  .bind(window.document);
const isFullScreen = () =>
  [
    'fullscreenElement',
    'mozFullScreenElement',
    'webkitFullscreenElement',
    'msFullscreenElement',
  ].some(p => window.document[p]);

const toggleFullScreen = () => {
  console.log('toggleFullscreen');
  if (isFullScreen()) {
    cancelFullScreen();
  } else {
    requestFullScreen();
  }
};

PIXI.Sprite.prototype.bringToFront = function () {
  if (this.parent) {
    const parent = this.parent;
    parent.removeChild(this);
    parent.addChild(this);
  }
};

fromEvent(document, 'DOMContentLoaded')
  .pipe(first())
  .subscribe(() => {
    const fullscreenToggle = document.querySelector('#fullscreenToggle');
    fromEvent(fullscreenToggle, 'click').subscribe(() => toggleFullScreen());

    const input = document.querySelector('input');
    const imageSelector = document.querySelector('#imageSelector');

    const app = new PIXI.Application({
      width: 1, // default: 800
      height: 1, // default: 600
      antialias: true, // default: false
      transparent: false, // default: false
      resizeTo: window,
      resolution: 1, // window.devicePixelRatio || 1,
    });
    app.renderer.backgroundColor = 'black';
    app.renderer.view.style.display = 'block';
    app.renderer.autoResize = true;
    app.renderer.context.mozImageSmoothingEnabled = app.renderer.context.webkitImageSmoothingEnabled =
      app.renderer.type === PIXI.WEBGL_RENDERER;
    app.view.style['transform'] = 'translatez(0)'; // iOS GPU workaround

    document.body.appendChild(app.view);

    const q = fromQueryString(window.location.search);

    const textureSubscriptions = [];
    let currentTexture;
    const textureSource = new Subject().pipe(
      switchMap(imageUrl => {
        for (const subscription of textureSubscriptions.splice(0)) {
          subscription.unsubscribe();
        }
        if (currentTexture) {
          app.stage.removeChildren();
          currentTexture.destroy(true);
          pieces.splice(0);
        }
        return PIXI.Texture.fromURL(imageUrl, { scaleMode: PIXI.SCALE_MODES.LINEAR });
      })
    );

    const pieces = [];

    textureSource.subscribe(nextTexture => {
      console.log('nextTexture', !!nextTexture);
      currentTexture = nextTexture;
      console.log('nextTexture', currentTexture.width, currentTexture.height);

      const numPieces = q.numPieces || 24;
      const requestedPieceSize = Math.sqrt(
        (currentTexture.width * currentTexture.height) / numPieces
      );
      const gridSize = Math.min(
        Math.trunc(currentTexture.width / Math.round(currentTexture.width / requestedPieceSize)),
        Math.trunc(currentTexture.height / Math.round(currentTexture.height / requestedPieceSize))
      );
      const columns = Math.trunc(currentTexture.width / gridSize);
      const rows = Math.trunc(currentTexture.height / gridSize);
      console.log({ gridSize, columns, rows });

      const rescale = () => {
        const scale = Math.min(
          window.innerWidth / (columns * gridSize),
          window.innerHeight / (rows * gridSize)
        );
        app.stage.scale.set(scale, scale);
      };

      for (let y = 0; y <= currentTexture.height - gridSize; y += gridSize) {
        for (let x = 0; x <= currentTexture.width - gridSize; x += gridSize) {
          pieces.splice(
            Math.trunc(Math.random() * (pieces.length + 1)),
            0,
            new PIXI.Sprite(
              new PIXI.Texture(currentTexture, new PIXI.Rectangle(x, y, gridSize, gridSize))
            )
          );
        }
      }

      for (const piece of pieces) {
        piece.anchor.set(0.5, 0.5);
        piece.zOrder = 0;
        piece.rotation = (Math.trunc(Math.random() * 4) * Math.PI) / 2;
        piece.goToSlot = function () {
          const slot = pieces.indexOf(this);
          const column = slot % columns;
          const row = Math.trunc(slot / columns);
          this.position.set((column + 0.5) * gridSize, (row + 0.5) * gridSize);
        };
        piece.moveToNearestSlot = function () {
          const x = Math.max(0, Math.min(columns * gridSize, this.x));
          const y = Math.max(0, Math.min(rows * gridSize, this.y));
          const nearestSlot = Math.trunc(y / gridSize) * columns + Math.trunc(x / gridSize);
          const runAway = pieces[nearestSlot];

          // Swap.
          pieces[pieces.indexOf(this)] = runAway;
          pieces[nearestSlot] = this;

          if (this !== runAway) {
            runAway.goToSlot();
          }
          this.goToSlot();
        };
        piece.rotateClockwise = function () {
          // @ts-ignore
          this.rotation = ((Math.round((this.rotation * 2) / Math.PI) + 1) * Math.PI) / 2;
        };
        piece.interactive = true;
        piece.buttonMode = true;
        app.stage.addChild(piece);
      }

      textureSubscriptions.push(
        merge(
          ...pieces.map(piece => fromEvent(piece, 'mousedown')),
          ...pieces.map(piece => fromEvent(piece, 'touchstart'))
        ).subscribe(e => {
          e.currentTarget.data = e.data;
          e.currentTarget.grabbed = true;
          e.currentTarget.grabOffset = new PIXI.Point();
          const grabPosition = e.currentTarget.data.getLocalPosition(e.currentTarget.parent);
          e.currentTarget.grabOffset.set(
            grabPosition.x - e.currentTarget.position.x,
            grabPosition.y - e.currentTarget.position.y
          );
          e.currentTarget.bringToFront();
        }),
        merge(
          ...pieces.map(piece => fromEvent(piece, 'mouseup')),
          ...pieces.map(piece => fromEvent(piece, 'mouseupoutside')),
          ...pieces.map(piece => fromEvent(piece, 'touchend')),
          ...pieces.map(piece => fromEvent(piece, 'touchendoutside'))
        ).subscribe(e => {
          if (e.currentTarget.dragging) {
            e.currentTarget.moveToNearestSlot();
          } else {
            e.currentTarget.rotateClockwise();
          }
          delete e.currentTarget.dragging;
          delete e.currentTarget.grabOffset;
          delete e.currentTarget.data;
        }),
        merge(
          ...pieces.map(piece => fromEvent(piece, 'mousemove')),
          ...pieces.map(piece => fromEvent(piece, 'touchmove'))
        )
          .pipe(filter(e => e.currentTarget.grabOffset))
          .subscribe(e => {
            e.currentTarget.dragging = true;
            const dragPosition = e.currentTarget.data.getLocalPosition(e.currentTarget.parent);
            e.currentTarget.position.set(
              dragPosition.x - e.currentTarget.grabOffset.x,
              dragPosition.y - e.currentTarget.grabOffset.y
            );
          }),
        merge(fromEvent(window, 'resize'), fromEvent(window, 'orientationchange'))
          .pipe(debounceTime(500))
          .subscribe(() => {
            rescale();
          })
      );

      for (const piece of pieces) {
        piece.goToSlot();
      }

      imageSelector.classList.add('hide');
      rescale();
    });

    // Receive files through drag'n'drop
    fromEvent(window, 'dragover').subscribe(e => e.preventDefault());
    merge(fromEvent(window, 'drop'), fromEvent(input, 'change'))
      .pipe(
        tap(e => e.preventDefault()),
        map(e => e.dataTransfer || e.currentTarget),
        mergeMap(dT =>
          from(
            (
              (dT.items &&
                Array.from(dT.items)
                  .filter(item => item.kind === 'file')
                  .map(fileItem => fileItem.getAsFile())) ||
              (dT.files && Array.from(dT.files)) ||
              []
            )
              // Ignore unsuitable files.
              .filter(file => file.type && file.type.startsWith('image/'))
              // Ignore subsequent images in the same batch.
              .slice(0, 1)
          )
        ),
        // Received a proper candidate image file.
        // Cancel any previous read and start reading the file into a data URL.
        switchMap(
          file =>
            new Promise((resolve, reject) =>
              Object.assign(new FileReader(), {
                onload: e => resolve(e.currentTarget.result),
                onerror: reject,
              }).readAsDataURL(file)
            )
        ),
        tap(() => toggleFullScreen())
      )
      .subscribe(dataUrl => textureSource.next(dataUrl));

    if (q.image) {
      textureSource.next(q.image);
    } else {
      imageSelector.classList.remove('hide');
    }
  });
