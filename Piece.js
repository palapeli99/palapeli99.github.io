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
    this.rotation = (Math.trunc(Math.random() * 4) * Math.PI) / 2;
    this.interactive = true;
    this.buttonMode = true;

    this.subscriptions = [
      merge(fromEvent(this, 'mousedown'), fromEvent(this, 'touchstart')).subscribe(e => {
        this.data = e.data;
        this.grabOffset = this.position.add(
          this.data.getLocalPosition(this['parent']).negate()
        );
      }),
      merge(
        fromEvent(this, 'mouseup'),
        fromEvent(this, 'mouseupoutside'),
        fromEvent(this, 'touchend'),
        fromEvent(this, 'touchendoutside')
      ).subscribe(() => {
        if (this.dragging) {
          // Move this piece from the temporary drag time position back 
          // to its original position in the container.
          this['parent'].swapWithPlaceholder(this);
          this.moveToNearestSlot();
        } else {
          this.rotateClockwise();
        }
        delete this.dragging;
        delete this.grabOffset;
        delete this.data;
      }),
      merge(fromEvent(this, 'mousemove'), fromEvent(this, 'touchmove'))
        .pipe(filter(() => this.grabOffset))
        .subscribe(() => {
          this.dragging = true;
          // Move this piece as the last child of the parent so that it will be
          // drawn on top of any other piece.
          this['parent'].swapWithPlaceholder(this);
          this.position = this.data
            .getLocalPosition(this['parent'])
            .add(this.grabOffset);
        }),
    ];
  }

  unsubscribe() {
    for (const subscription of this.subscriptions.splice(0)) {
      subscription.unsubscribe();
    }
  }

  moveToOwnSlot() {
    this['position'].set(
      ...this['parent'].getSlotPosition(this['parent'].getChildIndex(this)).values()
    );
  }

  moveToNearestSlot() {
    const parent = this['parent'];
    // const placeholderSlot = parent.getPlaceholderSlot();
    const mySlot = parent.getChildIndex(this);
    const nearestSlot = this['parent'].findNearestSlot(this['position']);

    // parent.swapSlotContents(placeholderSlot, nearestSlot);
    for(const piece of parent.swapSlotContents(nearestSlot, mySlot)) {
      piece.moveToOwnSlot();
    }
  }

  rotateClockwise() {
    // @ts-ignore
    this.rotation = ((Math.round((this.rotation * 2) / Math.PI) + 1) * Math.PI) / 2;
  }
}
