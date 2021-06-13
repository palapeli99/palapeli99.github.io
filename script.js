// @ts-ignore
import * as PIXI from 'https://cdn.skypack.dev/pixi.js@^6.0.2?min';
// @ts-ignore
import { fromEvent, Subject } from 'https://cdn.skypack.dev/rxjs@^6.6.7?min';
import {
  first,
  switchMap,
  // @ts-ignore
} from 'https://cdn.skypack.dev/rxjs@^6.6.7/operators?min';
import './pixiMixins.js'; // For side effects only.
import { requestFullScreen, toggleFullScreen } from './fullscreen.js';
import { bindTogether } from './inputUtils.js';
import { fromQueryString } from './queryString.js';
import { Table } from './Table.js';
import { imageFileDataUrlObservable } from './imageFileReceptionist.js';

// TODO: dnd file should reset any image file name in the query string.
// Also the numPieces input value could be reflected in the query string in real time.

// main()
fromEvent(document, 'DOMContentLoaded')
  .pipe(first())
  .subscribe(() => {
    // ===== SIMPLE UI HOOKS START =====
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
    // ===== SIMPLE UI HOOKS END =====

    // Initialize a PIXI application.
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
    app.stage = new Table();
    document.body.appendChild(app.view);

    // Declare a RxJS subject that will receive image URL's (including data URL's) from multiple sources
    // will provide ready made PIXI.Textures for observers' consumption. SwitchMap will discard any
    // unfinished texture if a new imageUrl arrives.
    const textureSource = new Subject().pipe(
      switchMap(imageUrl => {
        app.stage.reset();
        return PIXI.Texture.fromURL(imageUrl, { scaleMode: PIXI.SCALE_MODES.LINEAR });
      })
    );

    // Subscribe to the above subject and prepare the Table each time a new texture is received.
    textureSource.subscribe(nextTexture => {
      app.stage.texture = nextTexture;
      app.stage.cutPieces(
        Math.sqrt((nextTexture.width * nextTexture.height) / (numPiecesInput['value'] || 24))
      );
      app.stage.movePiecesToSlots();

      imageSelector.classList.add('hide');
    });

    // Receive files through the file input and through drag'n'drop
    fromEvent(window, 'dragover').subscribe(e => e.preventDefault());
    imageFileDataUrlObservable(
      fromEvent(window, 'drop'),
      fromEvent(fileInput, 'change')
    ).subscribe(dataUrl => {
      textureSource.next(dataUrl);
      requestFullScreen(); // Let's just assume that this is good here.
    });

    // Receive file URL's through the query string.
    if (q.image) {
      textureSource.next(q.image);
    } else {
      imageSelector.classList.remove('hide');
    }
  });
