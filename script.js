import * as PIXI from 'https://cdn.skypack.dev/pixi.js@^6.0.2?min';
import { from, fromEvent, merge, Subject } from 'https://cdn.skypack.dev/rxjs@^6.6.7?min';
import { debounceTime, first, switchMap, filter, map, mergeMap, tap } from 'https://cdn.skypack.dev/rxjs@^6.6.7/operators?min';

const fromQueryString = q => q
  .slice(1)
  .split('&')
  .map((p) => p.split('=').map(decodeURIComponent))
  .reduce((o, [key, value]) => {
    let p = o[key];
    if (p !== undefined) {
      Array.isArray(p) ? p.push(value) : (o[key] = [p, value]);
    } else {
      o[key] = value;
    }
    return o;
  }, {});

PIXI.Sprite.prototype.bringToFront = function() {
  if (this.parent) {		
    var parent = this.parent;		
    parent.removeChild(this);		
    parent.addChild(this);	
  }
}


fromEvent(document,'DOMContentLoaded').pipe(first()).subscribe(event => {
  const input = document.querySelector('input');
  const imageSelector = document.querySelector('#imageSelector');
  
  let app = new PIXI.Application({ 
    width: 1,         // default: 800
    height: 1,        // default: 600
    antialias: true,    // default: false
    transparent: false, // default: false
    resizeTo: window,
    resolution: 1, // window.devicePixelRatio || 1,
  });
  app.renderer.backgroundColor = 'black';
  app.renderer.view.style.display = 'block';
  app.renderer.autoResize = true;
  app.renderer.context.mozImageSmoothingEnabled = 
    app.renderer.context.webkitImageSmoothingEnabled =
    app.renderer.type == PIXI.WEBGL_RENDERER;
  app.view.style['transform'] = 'translatez(0)'; // iOS GPU workaround

  document.body.appendChild(app.view);

  const q = fromQueryString(window.location.search);
    
  const textureSource = new Subject().pipe(
    switchMap( imageUrl => PIXI.Texture.fromURL( imageUrl, { scaleMode: PIXI.SCALE_MODES.LINEAR } ))
  );
  let pieces = [];
  
  let textureSubscriptions = [];
  let currentTexture;
  textureSource.subscribe( nextTexture => {
    for( const subscription of textureSubscriptions ) {
      subscription.unsubscribe();
    }
    if( currentTexture ) {
      app.stage.removeChildren();
      currentTexture.destroy(true);
      pieces.splice(0);
    }
    currentTexture = nextTexture;
    console.log('nextTexture', currentTexture.width, currentTexture.height);
    
    const numPieces = q.numPieces||24;
    const requestedPieceSize = Math.sqrt(currentTexture.width*currentTexture.height/numPieces);
    const gridSize = Math.min(Math.trunc(currentTexture.width/Math.round(currentTexture.width/requestedPieceSize)), 
                               Math.trunc(currentTexture.height/Math.round(currentTexture.height/requestedPieceSize)));
    const columns = Math.trunc(currentTexture.width/gridSize);
    const rows = Math.trunc(currentTexture.height/gridSize);
    console.log({ gridSize, columns, rows });

    const rescale = () => {
      // const [ width, height ] = (currentTexture ? [ currentTexture.width, currentTexture.height ] : [ window.innerWidth, window.innerHeight ]);
      const scale = Math.min( window.innerWidth / (columns * gridSize), window.innerHeight / (rows * gridSize) );
      app.stage.scale.set( scale, scale );
      app.view.scrollIntoView();
    };

    for(let y=0; y<=currentTexture.height-gridSize; y+=gridSize) {
      for(let x=0; x<=currentTexture.width-gridSize; x+=gridSize) {
        pieces.splice(
          Math.trunc(Math.random()*(pieces.length+1)),
          0,
          new PIXI.Sprite( new PIXI.Texture(currentTexture, new PIXI.Rectangle(x,y,gridSize,gridSize) ) )
        );
      }
    }

    for(const piece of pieces) {
      piece.anchor.set( 0.5, 0.5 );
      piece.zOrder = 0;
      piece.rotation = Math.trunc(Math.random()*4)*Math.PI/2;
      piece.goToSlot = function() {
        const slot = pieces.indexOf(this);
        const column = slot % columns; 
        const row = Math.trunc( slot / columns );
        
        const newX = (column + 0.5) * gridSize;
        const newY = (row + 0.5) * gridSize;

        // This is a dirty hack where we rotate the piece instead of moving it
        // if it was dragged very little or not at all. I currently do not care
        // to think of a more logical solution.
        if( Math.abs(newX-this.x) <= 2
           && Math.abs(newY-this.y) <= 2) {
          piece.rotation = (Math.trunc(piece.rotation*2 / Math.PI)+1)*Math.PI/2;
        }

        this.position.set(
          (column + 0.5) * gridSize,
          (row + 0.5) * gridSize
        );
      };
      piece.moveToNearestSlot = function() {
        const x = Math.max(0, Math.min(columns*gridSize, this.x));
        const y = Math.max(0, Math.min(rows*gridSize, this.y));
        const nearestSlot = Math.trunc(y / gridSize) * columns + Math.trunc(x / gridSize);
        const runAway = pieces[nearestSlot];
        
        // Swap.
        pieces[pieces.indexOf(this)] = runAway;
        pieces[nearestSlot] = this;
        
        if(this!==runAway) {
          runAway.goToSlot();
        }
        this.goToSlot();
      };
      piece.interactive = true;
      piece.buttonMode = true;      
      app.stage.addChild( piece );
    }
    
    textureSubscriptions.push(
      merge(
        ...pieces.map( piece => fromEvent(piece, 'mousedown')),
        ...pieces.map( piece => fromEvent(piece, 'touchstart')),
      ).subscribe( e => {
        e.currentTarget.data = e.data;
        e.currentTarget.dragging = true;
        e.currentTarget.bringToFront();
      }),
      merge(
        ...pieces.map( piece => fromEvent(piece, 'mouseup')),
        ...pieces.map( piece => fromEvent(piece, 'mouseupoutside')),
        ...pieces.map( piece => fromEvent(piece, 'touchend')),
        ...pieces.map( piece => fromEvent(piece, 'touchendoutside')),
      ).subscribe( e => {
        e.currentTarget.dragging = false;
        e.currentTarget.data = null;
        e.currentTarget.moveToNearestSlot();
      }),
      merge(
        ...pieces.map( piece => fromEvent(piece, 'mousemove')),
        ...pieces.map( piece => fromEvent(piece, 'touchmove')),
      ).pipe(
        filter( e => e.currentTarget.dragging ),
      ).subscribe( e => 
        e.currentTarget.position.set( 
          ...Object.values(e.currentTarget.data.getLocalPosition(e.currentTarget.parent))
        )
      ),
      merge(
        fromEvent(window, 'resize'),
        fromEvent(window, 'orientationchange')
      ).pipe(
        debounceTime(500)
      ).subscribe((event) => {
        rescale();
      })
    );
    
    for(const piece of pieces) {
      piece.goToSlot();
    }

    imageSelector.classList.add('hide');
    rescale();
  });
  
  // Receive files through drag'n'drop
  fromEvent(window, 'dragover').subscribe( e => e.preventDefault() );
  merge(
    fromEvent(window, 'drop'),
    fromEvent(input, 'change'),
  ).pipe(
    tap( e => e.preventDefault() ),
    map( e => e.dataTransfer || e.currentTarget ),
    mergeMap( dT => from((
        (dT.items && Array.from(dT.items).filter( item => item.kind === 'file' ).map( fileItem => fileItem.getAsFile() ))
        || (dT.files && Array.from(dT.files))
        || []
      )
      // Ignore unsuitable files.
      .filter( file => file.type && file.type.startsWith('image/') )
      // Ignore subsequent images in the same batch.
      .slice(0,1)
    )),
    // Received a proper candidate image file.
    // Cancel any previous read and start reading the file into a data URL.
    switchMap( file => new Promise( (resolve, reject) => Object.assign(
      new FileReader(), {
        onload: e => resolve( e.currentTarget.result ),
        onerror: reject
      }).readAsDataURL(file)
    )),
  ).subscribe( dataUrl => textureSource.next(dataUrl) );

  if(q.image) {
    textureSource.next(q.image);
  } else {
    imageSelector.classList.remove('hide');
  }
});