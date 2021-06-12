// @ts-ignore
import { from, merge } from 'https://cdn.skypack.dev/rxjs@^6.6.7?min';
import {
  switchMap,
  map,
  mergeMap,
  tap,
  // @ts-ignore
} from 'https://cdn.skypack.dev/rxjs@^6.6.7/operators?min';

export const imageFileDataUrlObservable = (...eventSources) =>
  merge(...eventSources).pipe(
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
  );
