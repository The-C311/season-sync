const searchForm = document.getElementById('show-search-form');
const searchStatus = document.getElementById('search-status');
const searchResults = document.getElementById('search-results');
const seasonPicker = document.getElementById('season-picker');
const seasonOptions = document.getElementById('season-options');
const applySeasons = document.getElementById('apply-seasons');
let selectedShow = null;
let selectionVersion = 0;

async function requestTV(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Search unavailable');
    return response.json();
}

searchForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    const version = ++selectionVersion;
    selectedShow = null;
    seasonPicker.hidden = true;
    searchResults.replaceChildren();
    const query = document.getElementById('show-query').value.trim();
    if (!query) { searchStatus.textContent = 'Enter a show name to search.'; return; }
    searchStatus.textContent = 'Searching…';
    try {
        const shows = await requestTV(`/api/shows?q=${encodeURIComponent(query)}`);
        if (version !== selectionVersion) return;
        searchStatus.textContent = shows.length ? 'Choose your show.' : 'No shows found. Try another name or enter your plan manually.';
        for (const show of shows) {
            const item = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = `${show.name} (${show.premiered?.slice(0, 4) || 'year unknown'}) — ${show.network || show.language || 'TV show'}`;
            button.addEventListener('click', () => chooseShow(show));
            item.append(button);
            searchResults.append(item);
        }
    } catch {
        if (version === selectionVersion) searchStatus.textContent = 'Search is unavailable. Try again or enter your plan manually.';
    }
});

async function chooseShow(show) {
    const version = ++selectionVersion;
    selectedShow = null;
    seasonPicker.hidden = true;
    seasonOptions.replaceChildren();
    searchStatus.textContent = `Loading seasons for ${show.name}…`;
    try {
        const seasons = await requestTV(`/api/shows/${show.id}/seasons`);
        if (version !== selectionVersion) return;
        selectedShow = show;
        searchStatus.textContent = seasons.length ? `Select seasons of ${show.name} to rewatch.` : 'No aired episodes are available. Enter the plan manually.';
        for (const season of seasons) {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.seasonData = season;
            label.append(checkbox, document.createTextNode(` Season ${season.number}: ${season.episodeCount} aired episodes`));
            seasonOptions.append(label);
        }
        seasonPicker.hidden = !seasons.length;
    } catch {
        if (version === selectionVersion) searchStatus.textContent = 'Could not load seasons. Try again or enter your plan manually.';
    }
}

applySeasons.addEventListener('click', function () {
    const seasons = [...seasonOptions.querySelectorAll('input:checked')].map(input => input.seasonData);
    if (!selectedShow || !seasons.length) {
        searchStatus.textContent = 'Select at least one season.';
        return;
    }
    const count = seasons.reduce((sum, season) => sum + season.episodeCount, 0);
    const knownRuntime = seasons.reduce((sum, season) => sum + season.runtimeTotal, 0);
    const knownCount = seasons.reduce((sum, season) => sum + season.runtimeCount, 0);
    document.getElementById('show-name').value = selectedShow.name;
    document.getElementById('season-count').value = seasons.length;
    document.getElementById('episode-count').value = count;
    document.getElementById('episode-length').value = knownCount ? Math.round(knownRuntime / knownCount) : '';
    // A different show's old premiere date must not accidentally carry over.
    document.getElementById('release-date').value = '';
    document.getElementById('rewatch-form').dispatchEvent(new Event('input', { bubbles: true }));
    searchStatus.textContent = `Added seasons ${seasons.map(season => season.number).join(', ')} of ${selectedShow.name}. ` +
        (knownCount ? `Runtime is an estimate from ${knownCount} of ${count} episodes. ` : 'Runtime is unknown; enter it manually. ') +
        'Check the details below and enter the upcoming premiere date. Schedule episode numbers are relative to this selection.';
});
