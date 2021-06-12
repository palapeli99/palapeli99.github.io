import { fromEvent } from 'https://cdn.skypack.dev/rxjs@^6.6.7?min';
import {
  startWith,
  // @ts-ignore
} from 'https://cdn.skypack.dev/rxjs@^6.6.7/operators?min';
import { minmax } from './math.js';

const scale = (valueInput, rangeInput) => {
  valueInput.value = Math.trunc(
    Math.pow((rangeInput.value - rangeInput.min) / (rangeInput.max - rangeInput.min), 2) *
      (rangeInput.max - rangeInput.min) -
      -rangeInput.min
  );
};

const unScale = (valueInput, rangeInput) => {
  rangeInput.value =
    Math.trunc(
      (Math.sqrt(Number(valueInput.value) || rangeInput.min - rangeInput.min) *
        (rangeInput.max - rangeInput.min)) /
        Math.sqrt(rangeInput.max - rangeInput.min)
    ) - -rangeInput.min;
};

const limitToRange = (valueInput, rangeInput) => {
  valueInput.value = minmax(valueInput.value, rangeInput.min, rangeInput.max);
};

export const bindTogether = (valueInput, rangeInput) => [
  fromEvent(valueInput, 'input')
    .pipe(startWith(undefined))
    .subscribe(() => {
      limitToRange(valueInput, rangeInput);
      unScale(valueInput, rangeInput);
    }),
  fromEvent(rangeInput, 'input').subscribe(() => scale(valueInput, rangeInput)),
];
