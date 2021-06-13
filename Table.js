// @ts-ignore
import * as PIXI from 'https://cdn.skypack.dev/pixi.js@^6.0.2?min';
// @ts-ignore
import { fromEvent, merge, asyncScheduler } from 'https://cdn.skypack.dev/rxjs@^6.6.7?min';
import {
  throttleTime,
  // @ts-ignore
} from 'https://cdn.skypack.dev/rxjs@^6.6.7/operators?min';
import { Piece } from './Piece.js';

export class Table extends PIXI.Container {
  constructor(...args) {
    super(...args);

    this.texture = undefined;
    this.columns = 1;
    this.rows = 1;
    this.gridSize = Math.min(window.innerWidth, window.innerHeight);
    this.placeholder = new Piece();
    this.placeholder['visible'] = false;
    this['addChild'](this.placeholder);

    merge(fromEvent(window, 'resize'), fromEvent(window, 'orientationchange'))
      .pipe(throttleTime(500, asyncScheduler, { leading: true, trailing: true }))
      .subscribe(() => {
        this.rescale();
      });
  }

  reset() {
    if (this['children'].length > 1) {
      for (const piece of this['removeChildren'](0, this['children'].length - 1)) {
        piece.unsubscribe();
        piece.destroy({ texture: true });
      }
    }
    if (this.texture) {
      this.texture.destroy(true);
      this.texture = undefined;
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
    // them onto the Table in a random order.
    for (let y = 0; y <= this.texture.height - this.gridSize; y += this.gridSize) {
      for (let x = 0; x <= this.texture.width - this.gridSize; x += this.gridSize) {
        this['addChildAt'](
          new Piece(
            new PIXI.Texture(this.texture, new PIXI.Rectangle(x, y, this.gridSize, this.gridSize))
          ),
          Math.trunc(Math.random() * this['children'].length)
        );
      }
    }
  }

  getSlotPosition(slot) {
    return new PIXI.Point(
      ((slot % this.columns) + 0.5) * this.gridSize,
      (Math.trunc(slot / this.columns) + 0.5) * this.gridSize
    );
  }

  getPlaceholderSlot() {
    return this['getChildIndex'](this.placeholder);
  }

  swapSlotContents(slot1, slot2) {
    if (slot1 !== slot2) {
      const [min, max] = slot1 > slot2 ? [slot2, slot1] : [slot1, slot2];
      const tmp1 = this['removeChildAt'](max);
      const tmp2 = this['removeChildAt'](min);
      this['addChildAt'](tmp1, min);
      this['addChildAt'](tmp2, max);
      return [tmp1, tmp2];
    } else {
      return [this['getChildAt'](slot1)];
    }
  }

  swapWithPlaceholder(piece) {
    this.swapSlotContents(this['getChildIndex'](piece), this.getPlaceholderSlot());
  }

  findNearestSlot(point) {
    const limitedPoint = point.limit(
      { x: 0, y: 0 },
      { x: this.columns * this.gridSize - 1, y: this.rows * this.gridSize - 1 }
    );

    return (
      Math.trunc(limitedPoint.y / this.gridSize) * this.columns +
      Math.trunc(limitedPoint.x / this.gridSize)
    );
  }

  movePiecesToSlots() {
    for (const piece of this['children']) {
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
