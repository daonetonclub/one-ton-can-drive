// How it works: fills in the bins and the food bank from the Config tab.
// The page keeps its "coming soon" text if they aren't set or the server is slow.

(function () {
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  fetch(window.ONE_TON.api, { method: 'POST', headers: { 'Content-Type': 'text/plain' },
                              body: JSON.stringify({ action: 'leaderboard' }), redirect: 'follow' })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (!data.ok) return;
      if (data.foodBank) {
        var note = $('food-bank');
        note.innerHTML = '';
        note.appendChild(el('strong', '', 'Where it goes: '));
        note.appendChild(document.createTextNode('every can goes to ' + data.foodBank + ', which gets food to families in our area.'));
      }
      var bins = data.bins || [];
      if (!bins.length) return;
      var list = $('bin-list');
      list.innerHTML = '';
      bins.forEach(function (b) {
        var row = el('div', 'bin-row');
        row.appendChild(el('span', 'pin', '📍'));
        var text = el('div');
        text.appendChild(el('div', 'place', b.place));
        if (b.detail) text.appendChild(el('div', 'detail', b.detail));
        row.appendChild(text);
        list.appendChild(row);
      });
    })
    .catch(function () { /* keep the "coming soon" text */ });
})();
