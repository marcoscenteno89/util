const exists = ['', undefined, null, false, 'null'];

const contentType = 'application/x-www-form-urlencoded; application/json';

const withOk = res => res.json().then(data => {
  data.ok = res.ok;
  return data;
});

const get = (url, cstmSettings={}) => {
  const headers = { 'Content-Type': contentType };
  const settings = { mode: 'no-cors', ...cstmSettings };
  return fetch(url, new Headers(headers), settings).then(withOk).catch(err => console.log(err));
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
