const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadApp(storage = { data: null, getItem() { return this.data; }, setItem(key, value) { this.data = value; } }) {
    const handlers = {};
    function node() {
        return {
            textContent: '', hidden: true, children: [],
            append(...children) { this.children.push(...children); },
            replaceChildren() { this.children = []; },
            addEventListener(name, callback) { this[name] = callback; }
        };
    }
    const elements = {
        'rewatch-form': {
            reportValidity: () => true,
            requestSubmit: () => handlers.submit({ preventDefault() {} }),
            addEventListener: (name, callback) => { handlers[name] = callback; }
        },
        'watch-time-result': { textContent: '' },
        'daily-watch-time-result': { textContent: '' },
        'viewing-schedule': node(),
        'schedule-title': node(),
        'schedule-rows': node(),
        'more-days': node(),
        'saved-plans': node(),
        'save-status': node(),
        'save-plan': node(),
        'season-count': { value: '1' },
        'show-name': { value: 'Example Show' },
        'episode-count': { value: '3', valueAsNumber: 3 },
        'episode-length': { value: '45', valueAsNumber: 45 },
        'release-date': { value: '2026-11-09' }
    };
    class FixedDate extends Date {
        constructor(...args) {
            super(...(args.length ? args : [2026, 10, 5, 23, 30]));
        }
    }
    const context = vm.createContext({
        Date: FixedDate,
        localStorage: storage,
        document: { getElementById: id => elements[id], createElement: node }
    });
    vm.runInContext(fs.readFileSync(`${__dirname}/script.js`, 'utf8'), context);
    return { context, elements, handlers, storage };
}

test('calendar days handle midnight, DST, leap days, and year boundaries', () => {
    const { context } = loadApp();
    for (const [today, release, expected] of [
        [new Date(2026, 10, 5, 23, 59), '2026-11-06', 1],
        [new Date(2026, 2, 7, 12), '2026-03-09', 2],
        [new Date(2026, 9, 31, 12), '2026-11-02', 2],
        [new Date(2028, 1, 28, 12), '2028-03-01', 2],
        [new Date(2026, 11, 31, 12), '2027-01-01', 1],
        [new Date(2026, 10, 5), '2026-11-05', 0],
        [new Date(2026, 10, 5), '2026-11-04', -1]
    ]) assert.equal(context.calculateDaysRemaining(release, today), expected);
    for (const value of ['', 'bad-date', '2026-02-30']) {
        assert.ok(Number.isNaN(context.calculateDaysRemaining(value)));
    }
});

test('daily episodes round up without increasing exact divisions', () => {
    const { context } = loadApp();
    assert.equal(context.calculateDailyEpisodes(10, 4), 3);
    assert.equal(context.calculateDailyEpisodes(12, 4), 3);
    assert.equal(context.calculateDailyEpisodes(3, 100), 1);
});

test('form shows total and daily target, then clears stale answers', () => {
    const { elements, handlers } = loadApp();
    let prevented = false;
    handlers.submit({ preventDefault: () => { prevented = true; } });
    assert.ok(prevented);
    assert.match(elements['watch-time-result'].textContent, /135 minutes total/);
    assert.match(elements['daily-watch-time-result'].textContent, /Watch 1 episode per day.*4 days/);
    handlers.input();
    assert.equal(elements['daily-watch-time-result'].textContent, '');
    elements['release-date'].value = '2026-11-06';
    handlers.submit({ preventDefault() {} });
    assert.match(elements['daily-watch-time-result'].textContent, /Watch 3 episodes per day.*1 day,/);
});

test('past and same-day premieres keep total but request a future date', () => {
    for (const value of ['2026-11-05', '2026-11-04', '']) {
        const { elements, handlers } = loadApp();
        elements['release-date'].value = value;
        handlers.submit({ preventDefault() {} });
        assert.match(elements['daily-watch-time-result'].textContent, /future release date/);
        assert.match(elements['watch-time-result'].textContent, /135 minutes total/);
    }
});

test('large episode targets and invalid totals clear the old target', () => {
    const { elements, handlers } = loadApp();
    elements['episode-count'].valueAsNumber = 100;
    elements['release-date'].value = '2026-11-06';
    handlers.submit({ preventDefault() {} });
    assert.match(elements['daily-watch-time-result'].textContent, /Watch 100 episodes per day/);
    elements['episode-count'].valueAsNumber = Infinity;
    handlers.submit({ preventDefault() {} });
    assert.equal(elements['daily-watch-time-result'].textContent, '');
    assert.match(elements['watch-time-result'].textContent, /smaller/);
});

test('daily episode target is independent of runtime', () => {
    const { elements, handlers } = loadApp();
    elements['episode-count'].valueAsNumber = 10;
    handlers.submit({ preventDefault() {} });
    const target = elements['daily-watch-time-result'].textContent;
    assert.match(target, /Watch 3 episodes per day/);
    elements['episode-length'].valueAsNumber = 60;
    handlers.submit({ preventDefault() {} });
    assert.equal(elements['daily-watch-time-result'].textContent, target);
    assert.match(elements['watch-time-result'].textContent, /600 minutes total/);
});


test('schedule covers every episode once and stops before the premiere', () => {
    const { context } = loadApp();
    for (const [episodes, days] of [[10, 4], [12, 4], [3, 10], [1, 1], [100, 1]]) {
        const schedule = context.createViewingSchedule(episodes, days, new Date(2026, 10, 5));
        let nextEpisode = 1;
        for (const row of schedule) {
            assert.equal(row.firstEpisode, nextEpisode);
            assert.ok(row.lastEpisode <= episodes);
            nextEpisode = row.lastEpisode + 1;
        }
        assert.equal(nextEpisode, episodes + 1);
        assert.ok(schedule.length <= days);
    }
    const rows = context.createViewingSchedule(10, 4, new Date(2026, 10, 5));
    assert.equal(rows[3].firstEpisode, 10);
    assert.equal(rows[3].lastEpisode, 10);
    assert.equal(rows[3].date.getDate(), 8);
});

test('schedule dates advance across DST, leap day, and year end', () => {
    const { context } = loadApp();
    for (const [start, expected] of [
        [new Date(2026, 2, 7, 23, 30), [7, 8, 9]],
        [new Date(2026, 9, 31, 23, 30), [31, 1, 2]],
        [new Date(2028, 1, 28), [28, 29, 1]],
        [new Date(2026, 11, 31), [31, 1, 2]]
    ]) {
        const rows = context.createViewingSchedule(3, 3, start);
        assert.deepEqual(Array.from(rows, row => row.date.getDate()), expected);
    }
});

test('schedule renders, paginates without duplicates, and clears on edits', () => {
    const { elements, handlers } = loadApp();
    elements['episode-count'].valueAsNumber = 65;
    elements['release-date'].value = '2027-03-01';
    handlers.submit({ preventDefault() {} });
    assert.equal(elements['viewing-schedule'].hidden, false);
    assert.equal(elements['schedule-title'].textContent, 'Viewing schedule for Example Show');
    assert.equal(elements['schedule-rows'].children.length, 30);
    elements['more-days'].click();
    assert.equal(elements['schedule-rows'].children.length, 60);
    assert.equal(elements['schedule-rows'].children[30].children[1].textContent, 'Episode 31');
    elements['more-days'].click();
    assert.equal(elements['schedule-rows'].children.length, 65);
    assert.equal(elements['more-days'].hidden, true);
    handlers.input();
    assert.equal(elements['viewing-schedule'].hidden, true);
    assert.equal(elements['schedule-rows'].children.length, 0);
    elements['release-date'].value = '2026-11-04';
    handlers.submit({ preventDefault() {} });
    assert.equal(elements['viewing-schedule'].hidden, true);
});


test('saved plans persist across reloads, deduplicate, load all fields and delete', () => {
    const first = loadApp();
    first.elements['save-plan'].click();
    first.elements['save-plan'].click();
    assert.equal(JSON.parse(first.storage.data).length, 1);
    const second = loadApp(first.storage);
    assert.equal(second.elements['saved-plans'].children.length, 1);
    second.elements['show-name'].value = 'Changed';
    second.elements['saved-plans'].children[0].children[1].click();
    assert.equal(second.elements['show-name'].value, 'Example Show');
    assert.equal(second.elements['season-count'].value, '1');
    assert.equal(second.elements['episode-count'].value, '3');
    assert.equal(second.elements['episode-length'].value, '45');
    assert.equal(second.elements['release-date'].value, '2026-11-09');
    assert.equal(second.elements['viewing-schedule'].hidden, false);
    second.elements['saved-plans'].children[0].children[2].click();
    assert.equal(JSON.parse(first.storage.data).length, 0);
    assert.equal(loadApp(first.storage).elements['saved-plans'].children[0].textContent, 'No saved plans yet.');
});

test('changed plans are separate and invalid input cannot be saved', () => {
    const { elements, storage } = loadApp();
    elements['save-plan'].click();
    elements['show-name'].value = '<b>Another show</b>';
    elements['save-plan'].click();
    assert.equal(JSON.parse(storage.data).length, 2);
    assert.match(elements['saved-plans'].children[1].children[0].textContent, /<b>Another show<\/b>/);
    for (const value of ['', '0', '-1', '1.5']) {
        elements['episode-count'].value = value;
        elements['save-plan'].click();
        assert.equal(JSON.parse(storage.data).length, 2);
    }
});

test('corrupt storage and failed writes leave existing plans untouched', () => {
    for (const data of ['not json', '{}', '[{"show-name":"Missing fields"}]']) {
        const storage = { data, getItem() { return this.data; }, setItem(key, value) { this.data = value; } };
        const app = loadApp(storage);
        app.elements['save-plan'].click();
        assert.equal(storage.data, data);
        assert.match(app.elements['save-status'].textContent, /Could not save/);
        app.handlers.submit({ preventDefault() {} });
        assert.equal(app.elements['viewing-schedule'].hidden, false);
    }
    const app = loadApp();
    app.elements['save-plan'].click();
    const original = app.storage.data;
    app.storage.setItem = () => { throw new Error('quota'); };
    app.elements['show-name'].value = 'New';
    app.elements['save-plan'].click();
    assert.equal(app.storage.data, original);
    app.elements['saved-plans'].children[0].children[2].click();
    assert.equal(app.storage.data, original);
    assert.match(app.elements['save-status'].textContent, /Could not delete/);
});

test('expired saved plans load but cannot produce a dated schedule', () => {
    const app = loadApp();
    app.elements['save-plan'].click();
    const saved = JSON.parse(app.storage.data);
    saved[0]['release-date'] = '2026-11-04';
    app.storage.data = JSON.stringify(saved);
    const loaded = loadApp(app.storage);
    loaded.elements['saved-plans'].children[0].children[1].click();
    assert.equal(loaded.elements['viewing-schedule'].hidden, true);
    assert.match(loaded.elements['daily-watch-time-result'].textContent, /future release date/);
});
