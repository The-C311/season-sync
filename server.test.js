const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer, summarizeEpisodes } = require('./server');

test('season summaries exclude future, unknown-date and special episodes and retain missing runtimes', () => {
    const episode = { season: 1, number: 1, airstamp: '2020-01-01T00:00:00Z', runtime: 40 };
    const result = summarizeEpisodes([episode, { ...episode, number: 2, runtime: null },
        { ...episode, number: null }, { ...episode, airstamp: null },
        { ...episode, airstamp: '2099-01-01T00:00:00Z' }], Date.parse('2026-01-01'));
    assert.deepEqual(result, [{ number: 1, episodeCount: 2, runtimeTotal: 40, runtimeCount: 1 }]);
});

test('HTTP routes validate, proxy only TVmaze, protect project files and handle upstream failure', async t => {
    const calls = [];
    const server = createServer(async url => {
        calls.push(url);
        if (url.includes('/999/')) throw new Error('offline');
        return { ok: true, json: async () => url.includes('/episodes') ? [] : [
            { show: { id: 1, name: 'Example', premiered: '2020-01-01', network: { name: 'Network' } } }
        ] };
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/`)).status, 200);
    for (const file of ['/server.js', '/.git/config', '/script.test.js', '/package.json']) {
        assert.equal((await fetch(base + file)).status, 404);
    }
    assert.equal((await fetch(`${base}/api/shows?q=`)).status, 400);
    const response = await fetch(`${base}/api/shows?q=Example%20show`);
    assert.equal((await response.json())[0].name, 'Example');
    assert.equal(calls[0], 'https://api.tvmaze.com/search/shows?q=Example%20show');
    assert.deepEqual(await (await fetch(`${base}/api/shows/1/seasons`)).json(), []);
    assert.equal((await fetch(`${base}/api/shows/999/seasons`)).status, 502);
    assert.equal((await fetch(`${base}/api/shows`, { method: 'POST' })).status, 405);
});
