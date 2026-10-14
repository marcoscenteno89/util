const exists = ['', undefined, null, false, 'null'];

const contentType = 'application/x-www-form-urlencoded; application/json';

const withOk = res => res.json().then(data => {
  data.ok = res.ok;
  return data;
});

/**
 * GET a JSON endpoint. `settings` are fetch() options; `settings.headers` (plain object) are merged in.
 * Resolves to the parsed JSON with `ok` added, or `{ ok: false, error }` on network or parse failure.
 */
const get = (url, settings={}) => {
  return fetch(url, {
    ...settings,
    headers: new Headers({ Accept: 'application/json', ...settings.headers })
  }).then(withOk).catch(error => {
    console.log(error);
    return { ok: false, error };
  });
}

const post = (url, body, headers={}, settings={}) => {
  return fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: new Headers({ 'Content-Type': contentType, ...headers }),
    body: JSON.stringify(body)
  }, settings).then(withOk).catch(err => err);
}

const storageAvailable = () => {
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
    return true;
  } catch (e) {
    console.log('localStorage not available');
    return false;
  }
}

export { exists, get, post, storageAvailable }
