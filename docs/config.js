// Where the page finds the program behind it. This address never changes:
// always update the existing deployment, never make a new one.
window.ONE_TON = {
  api: 'https://script.google.com/macros/s/AKfycbwc4fukEa6Jh_hT4Qhl1_Bt3mZvgFsDJb1kU7FMVnyzrSAeZZrEqOAxVerIdW_zchk/exec',
  organizerEmail: 'daonetonclub@gmail.com'
};

// Every request goes as a plain address (GET with the details in the query).
// A POST body can be dropped when the browser is signed into Google and
// follows Google's extra redirects; the program then sees an empty request
// ("Unknown action"). The address survives those redirects.
window.ONE_TON.call = function (params) {
  var query = Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
  return fetch(window.ONE_TON.api + '?' + query, { method: 'GET', redirect: 'follow', cache: 'no-store' })
    .then(function (res) { return res.json(); });
};
