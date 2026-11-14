const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

// Only these public files are served: source tests and saved project files stay private.
const assets = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'],
    '/style.css': ['style.css', 'text/css'], '/script.js': ['script.js', 'text/javascript'],
    '/search.js': ['search.js', 'text/javascript'] };

function summarizeEpisodes(episodes, now = Date.now()) {
    const seasons = new Map();
    for (const episode of episodes) {
        if (!Number.isInteger(episode.season) || episode.season < 1 ||
            !Number.isInteger(episode.number) || episode.number < 1 ||
            !episode.airstamp || !(Date.parse(episode.airstamp) <= now)) continue;
        if (!seasons.has(episode.season)) seasons.set(episode.season, { number: episode.season, episodeCount: 0, runtimeTotal: 0, runtimeCount: 0 });
        const season = seasons.get(episode.season);
        season.episodeCount++;
        if (Number.isFinite(episode.runtime) && episode.runtime > 0) {
            season.runtimeTotal += episode.runtime;
            season.runtimeCount++;
        }
    }
    return [...seasons.values()].sort((a, b) => a.number - b.number);
}

function createServer(fetchTV = fetch) {
    async function tvmaze(route) {
        const response = await fetchTV(`https://api.tvmaze.com${route}`, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('TV service unavailable');
        return response.json();
    }
    return http.createServer(async (req, res) => {
        const send = (status, data) => {
            res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify(data));
        };
        try {
            const url = new URL(req.url, 'http://localhost');
            if (req.method !== 'GET') return send(405, { error: 'Method not allowed' });
            if (url.pathname === '/api/shows') {
                const query = (url.searchParams.get('q') || '').trim();
                if (!query || query.length > 100) return send(400, { error: 'Enter a show name of 1–100 characters.' });
                const matches = await tvmaze(`/search/shows?q=${encodeURIComponent(query)}`);
                return send(200, matches.slice(0, 10).map(({ show }) => ({
                    id: show.id, name: show.name, premiered: show.premiered,
                    network: show.network?.name || show.webChannel?.name || '', language: show.language
                })));
            }
            const match = url.pathname.match(/^\/api\/shows\/([1-9]\d{0,8})\/seasons$/);
            if (match) {
                const episodes = await tvmaze(`/shows/${match[1]}/episodes`);
                return send(200, summarizeEpisodes(episodes));
            }
            const asset = assets[url.pathname];
            if (!asset) return send(404, { error: 'Not found' });
            const content = await fs.readFile(path.join(__dirname, asset[0]));
            res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff' });
            res.end(content);
        } catch {
            send(502, { error: 'TV search is unavailable right now. Try again or enter your plan manually.' });
        }
    });
}

if (require.main === module) {
    const port = Number(process.env.PORT || 8765);
    createServer().listen(port, '127.0.0.1', () => console.log(`Season Sync: http://127.0.0.1:${port}`));
}
module.exports = { createServer, summarizeEpisodes };
