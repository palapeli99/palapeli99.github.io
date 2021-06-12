export const fromQueryString = q =>
  q
    .slice(1)
    .split('&')
    .map(p => p.split('=').map(decodeURIComponent))
    .reduce((o, [key, value]) => {
      const p = o[key];
      if (p !== undefined) {
        Array.isArray(p) ? p.push(value) : (o[key] = [p, value]);
      } else {
        o[key] = value;
      }
      return o;
    }, {});
