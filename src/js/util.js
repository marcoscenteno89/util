const exists = [''.trim(), undefined, null, false, 'null'];

const get = (url, cstmSettings={}) => {
  let tmp;
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded; application/json'
  }
  const settings = {
    mode: 'no-cors',
    ...cstmSettings
  }
  return fetch(url, new Headers(headers), settings).then(res => {
    tmp = res.ok;
    return res.json();
  }).then(data => {
    data.ok = tmp;
    return data;
  }).catch(err => console.log(err));
}

const post = (url, body, headers={}, settings={}) => {
  const headersData = {
    'Content-Type': 'application/x-www-form-urlencoded; application/json',
    ...headers,
  }
 
  let tmp;
  return fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: new Headers(headersData),
    body: JSON.stringify(body) 
  }, settings).then(res => {
    tmp = res.ok;
    return res.json();
  }).then(data => {
    data.ok = tmp;
    return data;
  }).catch(err => err);
}

export { exists, get, post }