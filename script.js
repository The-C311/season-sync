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

form.addEventListener("submit", function (event) {
    event.preventDefault();
    dailyResult.textContent = "";

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
    const daysRemaining = calculateDaysRemaining(releaseDate);
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

});

// Clear the previous answer when the user changes their plan.
form.addEventListener("input", function () {
    result.textContent = "Enter your show's information and calculate watch time.";
    dailyResult.textContent = "";
});
