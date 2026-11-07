// Episode count is the total across all seasons.
function calculateTotalWatchTime(episodeCount, episodeLength) {
    return episodeCount * episodeLength;
}

function formatWatchTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours} hr ${minutes} min (${totalMinutes} minutes total)`;
}

function calculateDaysRemaining(releaseDate, today = new Date()) {
    // Compare calendar dates, not elapsed hours (which can change with DST).
    const premiere = new Date(`${releaseDate}T00:00:00.000Z`);
    if (!Number.isFinite(premiere.getTime()) ||
        premiere.toISOString().split("T")[0] !== releaseDate) {
        return NaN;
    }
    const currentDay = new Date(0);
    currentDay.setUTCFullYear(today.getFullYear(), today.getMonth(), today.getDate());
    return (premiere.getTime() - currentDay.getTime()) / 86400000;
}

function calculateDailyEpisodes(episodeCount, daysRemaining) {
    // Round up so the daily target leaves enough time to finish.
    return Math.ceil(episodeCount / daysRemaining);
}

const form = document.getElementById("rewatch-form");
const result = document.getElementById("watch-time-result");
const dailyResult = document.getElementById("daily-watch-time-result");
const scheduleSection = document.getElementById("viewing-schedule");
const scheduleTitle = document.getElementById("schedule-title");
const scheduleRows = document.getElementById("schedule-rows");
const moreDays = document.getElementById("more-days");
let currentPlan = null;
let displayedDays = 0;

function createViewingSchedule(episodeCount, daysRemaining, today = new Date(), offset = 0, limit = 30) {
    const dailyEpisodes = calculateDailyEpisodes(episodeCount, daysRemaining);
    const watchingDays = Math.ceil(episodeCount / dailyEpisodes);
    const schedule = [];
    for (let day = offset; day < Math.min(watchingDays, offset + limit); day++) {
        const date = new Date(today.getTime());
        // Move by calendar days so daylight-saving changes don't shift the date.
        date.setDate(today.getDate() + day);
        const firstEpisode = day * dailyEpisodes + 1;
        const lastEpisode = Math.min(episodeCount, firstEpisode + dailyEpisodes - 1);
        schedule.push({ date, firstEpisode, lastEpisode });
    }
    return schedule;
}

function clearSchedule() {
    currentPlan = null;
    displayedDays = 0;
    scheduleRows.replaceChildren();
    scheduleSection.hidden = true;
}

function showMoreDays() {
    if (!currentPlan) return;
    const { episodeCount, daysRemaining, today } = currentPlan;
    const days = createViewingSchedule(episodeCount, daysRemaining, today, displayedDays);
    for (const day of days) {
        const row = document.createElement("tr");
        const dateCell = document.createElement("td");
        dateCell.textContent = day.date.toLocaleDateString(undefined, {
            weekday: "short", month: "short", day: "numeric", year: "numeric"
        });
        const episodesCell = document.createElement("td");
        episodesCell.textContent = day.firstEpisode === day.lastEpisode
            ? `Episode ${day.firstEpisode}`
            : `Episodes ${day.firstEpisode}–${day.lastEpisode}`;
        row.append(dateCell, episodesCell);
        scheduleRows.append(row);
    }
    displayedDays += days.length;
    const watchingDays = Math.ceil(episodeCount / calculateDailyEpisodes(episodeCount, daysRemaining));
    moreDays.hidden = displayedDays >= watchingDays;
}

moreDays.addEventListener("click", showMoreDays);

form.addEventListener("submit", function (event) {
    event.preventDefault();
    dailyResult.textContent = "";
    clearSchedule();

    if (!form.reportValidity()) {
        return;
    }

    const episodeCount = document.getElementById("episode-count").valueAsNumber;
    const episodeLength = document.getElementById("episode-length").valueAsNumber;
    const totalMinutes = calculateTotalWatchTime(episodeCount, episodeLength);

    // Avoid rounded or infinite results for excessively large inputs.
    if (!Number.isSafeInteger(totalMinutes) || totalMinutes < 1) {
        result.textContent = "Please enter smaller, positive whole numbers for episodes and runtime.";
        return;
    }

    result.textContent = `Total watch time: ${formatWatchTime(totalMinutes)}.`;

    const releaseDate = document.getElementById("release-date").value;
    const today = new Date();
    const daysRemaining = calculateDaysRemaining(releaseDate, today);
    if (!Number.isFinite(daysRemaining) || daysRemaining <= 0) {
        dailyResult.textContent = "Choose a future release date to calculate a daily episode target.";
        return;
    }

    const dailyEpisodes = calculateDailyEpisodes(episodeCount, daysRemaining);
    dailyResult.textContent =
        `Watch ${dailyEpisodes} ${dailyEpisodes === 1 ? "episode" : "episodes"} per day ` +
        `to finish before the premiere. You have ${daysRemaining} ` +
        `${daysRemaining === 1 ? "day" : "days"}, starting today. ` +
        "Your final watching day may have fewer episodes, and you may finish early.";

    currentPlan = { episodeCount, daysRemaining, today };
    scheduleTitle.textContent = `Viewing schedule for ${document.getElementById("show-name").value.trim()}`;
    scheduleSection.hidden = false;
    showMoreDays();

});

// Clear the previous answer when the user changes their plan.
form.addEventListener("input", function () {
    result.textContent = "Enter your show's information and calculate watch time.";
    dailyResult.textContent = "";
    clearSchedule();
});
