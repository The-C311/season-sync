// Episode count is the total across all seasons.
function calculateTotalWatchTime(episodeCount, episodeLength) {
    return episodeCount * episodeLength;
}

function formatWatchTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours} hr ${minutes} min (${totalMinutes} minutes total)`;
}

const form = document.getElementById("rewatch-form");
const result = document.getElementById("watch-time-result");

form.addEventListener("submit", function (event) {
    event.preventDefault();

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
});

// Clear the previous answer when the user changes their plan.
form.addEventListener("input", function () {
    result.textContent = "Enter your show's information and calculate total watch time.";
});
