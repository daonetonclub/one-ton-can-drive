// The home page. Fills in the drive dates and running contests from the
// Sheet; the page still works with its default text if the server is slow.

(function () {
  var $ = function (id) { return document.getElementById(id); };

  function shortDate(day) {
    var p = day.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  fetch(window.ONE_TON.api, { method: 'POST', headers: { 'Content-Type': 'text/plain' },
                              body: JSON.stringify({ action: 'leaderboard' }), redirect: 'follow' })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (!data.ok) return;
      if (data.startDay && data.endDay) {
        $('eyebrow').textContent = 'Durham Academy · ' + shortDate(data.startDay) + ' to ' + shortDate(data.endDay);
      }
      var running = (data.contests || []).length;
      $('tagline').textContent = 'One school. One goal. One ton of cans. ' + (running
        ? running + (running === 1 ? ' contest' : ' contests') + ' running right now, and every can counts toward all of them.'
        : 'Every can counts.');
    })
    .catch(function () { /* keep the default text */ });
})();
