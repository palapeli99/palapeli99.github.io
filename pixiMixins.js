// @ts-ignore
import * as PIXI from 'https://cdn.skypack.dev/pixi.js@^6.0.2?min';

PIXI.Sprite.prototype.bringToFront = function () {
  if (this.parent) {
    const parent = this.parent;
    parent.removeChild(this);
    parent.addChild(this);
  }
};

for (const type of [PIXI.Point, PIXI.ObservablePoint]) {
  Object.assign(type['prototype'], {
    add: function (p) {
      return new PIXI.Point(this['x'] + p.x, this['y'] + p.y);
    },
    negate: function () {
      return new PIXI.Point(-this['x'], -this['y']);
    },
    values: function () {
      return ['x', 'y'].map(p => this[p]);
    },
  });
}