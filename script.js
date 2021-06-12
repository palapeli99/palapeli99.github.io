// @ts-ignore
import * as PIXI from 'https://cdn.skypack.dev/pixi.js@^6.0.2?min';
// @ts-ignore
import { from, fromEvent, merge, Subject } from 'https://cdn.skypack.dev/rxjs@^6.6.7?min';
import {
  first,
  switchMap,
  map,
  mergeMap,
  tap,
  // @ts-ignore
} from 'https://cdn.skypack.dev/rxjs@^6.6.7/operators?min';
import './pixiMixins.js'; // For side effects only.
import { requestFullScreen, toggleFullScreen } from './fullscreen.js';
import { bindTogether } from './inputUtils.js';
import { fromQueryString } from './queryString.js';
import { Table } from './Table.js';

// TODO: dnd file should reset any image file name in the query string.
// Also the numPieces input value could be reflected in the query string in real time.

fromEvent(document, 'DOMContentLoaded')
  .pipe(first())
  .subscribe(() => {
    const q = fromQueryString(window.location.search);

    const fileInput = document.querySelector('#fileInput');
    const imageSelector = document.querySelector('#imageSelector');
    const numPiecesInput = document.querySelector('#numPiecesInput');
    numPiecesInput['value'] = q.numPieces || numPiecesInput['value'] || 24;

    // Bind the number-of-pieces slider to the numeric input field value
    // so that the values of both inputs stay in sync.
    bindTogether(numPiecesInput, document.querySelector('#numPiecesSlider'));

    fromEvent(document.querySelector('#pickDefaultButton'), 'click').subscribe(() => {
      window.location.href = '?image=default.jpeg&numPieces=' + numPiecesInput['value'];
    });

    fromEvent(document.querySelector('#fullscreenToggle'), 'click').subscribe(() =>
      toggleFullScreen()
    );

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
    app.stage = new Table();

    const textureSource = new Subject().pipe(
      switchMap(imageUrl => {
        app.stage.reset();
        return PIXI.Texture.fromURL(imageUrl, { scaleMode: PIXI.SCALE_MODES.LINEAR });
      })
    );

    textureSource.subscribe(nextTexture => {
      app.stage.texture = nextTexture;
      app.stage.cutPieces(
        Math.sqrt((nextTexture.width * nextTexture.height) / (numPiecesInput['value'] || 24))
      );
      app.stage.movePiecesToSlots();

      imageSelector.classList.add('hide');
    });

    // Receive files through drag'n'drop
    fromEvent(window, 'dragover').subscribe(e => e.preventDefault());
    merge(fromEvent(window, 'drop'), fromEvent(fileInput, 'change'))
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
        tap(() => requestFullScreen())
      )
      .subscribe(dataUrl => textureSource.next(dataUrl));

    if (q.image) {
      textureSource.next(q.image);
    } else {
      imageSelector.classList.remove('hide');
    }
  });
