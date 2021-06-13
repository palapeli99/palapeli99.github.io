// @ts-ignore
import * as PIXI from 'https://cdn.skypack.dev/pixi.js@^6.0.2?min';
import { minmax } from './math.js';

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
    limit: function(min,max) {
      return new PIXI.Point(minmax(this['x'], min.x, max.x), minmax(this['y'], min.y, max.y));
    },
  });
}
