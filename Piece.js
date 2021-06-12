// @ts-ignore
import * as PIXI from 'https://cdn.skypack.dev/pixi.js@^6.0.2?min';
// @ts-ignore
import { fromEvent, merge } from 'https://cdn.skypack.dev/rxjs@^6.6.7?min';
import {
  filter,
  // @ts-ignore
} from 'https://cdn.skypack.dev/rxjs@^6.6.7/operators?min';

export class Piece extends PIXI.Sprite {
  constructor(...args) {
    super(...args);

    this['anchor'].set(0.5, 0.5);
    this.zOrder = 0;
    this.rotation = (Math.trunc(Math.random() * 4) * Math.PI) / 2;
    this.interactive = true;
    this.buttonMode = true;

    this.subscriptions = [
      merge(fromEvent(this, 'mousedown'), fromEvent(this, 'touchstart')).subscribe(e => {
        e.currentTarget.data = e.data;
        e.currentTarget.grabbed = true;
        e.currentTarget.grabOffset = e.currentTarget.position.add(
          e.currentTarget.data.getLocalPosition(e.currentTarget.parent).negate()
        );

        e.currentTarget.bringToFront();
      }),
      merge(
        fromEvent(this, 'mouseup'),
        fromEvent(this, 'mouseupoutside'),
        fromEvent(this, 'touchend'),
        fromEvent(this, 'touchendoutside')
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
      merge(fromEvent(this, 'mousemove'), fromEvent(this, 'touchmove'))
        .pipe(filter(e => e.currentTarget.grabOffset))
        .subscribe(e => {
          e.currentTarget.dragging = true;
          e.currentTarget.position = e.currentTarget.data
            .getLocalPosition(e.currentTarget.parent)
            .add(e.currentTarget.grabOffset);
        }),
    ];
  }

  unsubscribe() {
    for(const subscription of this.subscriptions.splice(0)) {
      subscription.unsubscribe();
    }
  }

  moveToOwnSlot() {
    this['position'].set(...this['parent'].getSlotPoint(this['parent'].getSlotFor(this)).values());
  }

  moveToNearestSlot() {
    for (const piece of this['parent'].swapSlotContents(
      this['parent'].findNearestSlot(this['position']),
      this['parent'].getSlotFor(this)
    )) {
      piece.moveToOwnSlot();
    }
  }

  rotateClockwise() {
    // @ts-ignore
    this.rotation = ((Math.round((this.rotation * 2) / Math.PI) + 1) * Math.PI) / 2;
  }
}
