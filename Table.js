// @ts-ignore
import * as PIXI from 'https://cdn.skypack.dev/pixi.js@^6.0.2?min';
// @ts-ignore
import { fromEvent, merge, asyncScheduler } from 'https://cdn.skypack.dev/rxjs@^6.6.7?min';
import {
  throttleTime,
  startWith,
  // @ts-ignore
} from 'https://cdn.skypack.dev/rxjs@^6.6.7/operators?min';
import { Piece } from './Piece.js';

export class Table extends PIXI.Container {
  constructor(...args) {
    super(...args);
    this.pieces = [];
    this.texture = undefined;
    this.columns = 1;
    this.rows = 1;
    this.gridSize = Math.min(window.innerWidth, window.innerHeight);

    merge(fromEvent(window, 'resize'), fromEvent(window, 'orientationchange'))
      .pipe(throttleTime(500, asyncScheduler, { leading: true, trailing: true }))
      .subscribe(() => {
        this.rescale();
      });
  }

  reset() {
    for (const piece of this.pieces.splice(0)) {
      piece.unsubscribe();
    }
    if (this.texture) {
      this['removeChildren']();
      this.texture.destroy(true);
    }
  }

  cutPieces(requestedPieceSize) {
    this.gridSize = Math.min(
      Math.trunc(this.texture.width / Math.round(this.texture.width / requestedPieceSize)),
      Math.trunc(this.texture.height / Math.round(this.texture.height / requestedPieceSize))
    );
    this.columns = Math.trunc(this.texture.width / this.gridSize);
    this.rows = Math.trunc(this.texture.height / this.gridSize);
    this.rescale();

    // Cut the texture into pieces, creating a new PIXI.Sprite for each piece and inserting
    // them into the pieces array in a random order.
    for (let y = 0; y <= this.texture.height - this.gridSize; y += this.gridSize) {
      for (let x = 0; x <= this.texture.width - this.gridSize; x += this.gridSize) {
        this.pieces.splice(
          Math.trunc(Math.random() * (this.pieces.length + 1)),
          0,
          new Piece(
            new PIXI.Texture(this.texture, new PIXI.Rectangle(x, y, this.gridSize, this.gridSize))
          )
        );
      }
    }
    for (const piece of this.pieces) {
      this['addChild'](piece);
    }
  }

  getSlotFor(piece) {
    return this.pieces.indexOf(piece);
  }

  getSlotPoint(slot) {
    return new PIXI.Point(
      ((slot % this.columns) + 0.5) * this.gridSize,
      (Math.trunc(slot / this.columns) + 0.5) * this.gridSize
    );
  }

  swapSlotContents(slot1, slot2) {
    const tmp1 = this.pieces[slot1];
    if (slot1 !== slot2) {
      const tmp2 = this.pieces[slot2];
      this.pieces[slot1] = tmp2;
      this.pieces[slot2] = tmp1;
      return [tmp1, tmp2];
    } else {
      return [tmp1];
    }
  }

  findNearestSlot(point) {
    const limitedPoint = point.limit(
      { x: 0, y: 0 },
      { x: this.columns * this.gridSize, y: this.rows * this.gridSize }
    );

    return (
      Math.trunc(limitedPoint.y / this.gridSize) * this.columns +
      Math.trunc(limitedPoint.x / this.gridSize)
    );
  }

  movePiecesToSlots() {
    for (const piece of this.pieces) {
      piece.moveToOwnSlot();
    }
  }

  rescale() {
    const scale = Math.min(
      window.innerWidth / (this.columns * this.gridSize),
      window.innerHeight / (this.rows * this.gridSize)
    );
    this['scale'].set(scale, scale);
  }
}
