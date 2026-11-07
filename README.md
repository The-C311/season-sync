# Season Sync

Season Sync is a web application that helps users calculate
how much of a television series they need to watch each day before
a new season is released.

## Current Features

- Enter a show name
- Enter the number of seasons and episodes
- Enter the average episode runtime
- Enter the new season release date
- Calculate total watch time in hours and minutes
- Calculate required episodes per day before the premiere

- Create a personalized viewing schedule

## Planned Features
- Save rewatch plans
- Search for television shows using an API

## Built With

- HTML
- CSS
- JavaScript

## Project Status

This project is currently in development. Total watch time, daily episode targets, and dated viewing schedules are available.

## Calculate Watch Time

Open `index.html` in a browser, fill in the form, and select **Calculate Rewatch Plan**.
Use the total episode count across all selected seasons. For example, 3 episodes at
45 minutes each gives **2 hr 15 min (135 minutes total)**. Seasons and the release
date do not affect this total. The release date determines your daily target.

The daily episode target divides the total episodes by the calendar days from today
up to (but not including) the premiere, rounding up to a whole episode. For example,
10 episodes over 4 days means 3 episodes per day, with 1 episode on the final day.
You may finish early when there are more days than you need. Today's date comes
from your device's local timezone. Past or same-day premieres require a future date.

Run the automated checks with `node --test script.test.js`.

## Personalized Viewing Schedule

Calculate a plan to see a dated table for your show, starting today. Each row lists
an episode or episode range using continuous numbering across all seasons. The
schedule follows your rounded-up daily episode target, with fewer episodes on the
last watching day if necessary. It stops when all episodes are assigned, before
the premiere. Long schedules show 30 days at a time; use **Show next 30 days** to
see more. Editing any input clears the old schedule until you recalculate.
