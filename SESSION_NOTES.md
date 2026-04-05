# YoutubePin Extension - Session Notes

## What the extension does
A Chrome extension for YouTube with two features:

### 1. Pinned Video (Sidebar + Home Feed)
- On video pages, injects a pinned video as the first sidebar recommendation
- Video is selected from `videos.json` based on even/odd minutes
- `videos.json` is a plain array — index selected via `OddsEvens = minutes % 2`
- Currently has: Rick Astley (even) and Duck Song (odd)

### 2. +Qr8 Button
- Injects a `+Qr8` button on the far LEFT of the YouTube actions bar (using margin-right: auto inside ytd-menu-renderer which has justify-content: flex-end)
- Clicking it saves the current video to a YouTube playlist called "Qurate"
- If "Qurate" doesn't exist, it creates it (Public visibility) automatically
- If video is already in Qurate, shows confirm dialog: "This video is already Qurated, would you like to remove it?"

## Key files
- `content.js` — main extension logic
- `manifest.json` — Chrome extension config, includes web_accessible_resources for videos.json
- `videos.json` — array of videos to pin

## Known issues / things still being worked on
- Sidebar pinned video thumbnail sometimes doesn't load (YouTube lazy loader resets src)
- +Qr8 button disappears on some video navigations (retry logic at 1s, 2.5s, 5s)
- Home feed pinned video was started but reverted — needs rework
- The "Qurate" playlist creation flow: textarea (not input), dropdown uses yt-list-item-view-model[role="menuitem"] for Public option, Create button uses aria-label="Create"

## YouTube DOM key selectors (2025/2026)
- Sidebar recommendations container: `ytd-watch-next-secondary-results-renderer ytd-item-section-renderer #contents`
- Sidebar video cards: `yt-lockup-view-model` (new) or `ytd-compact-video-renderer` (old)
- Actions bar: `ytd-watch-metadata ytd-menu-renderer` (justify-content: flex-end)
- Save modal playlists: `yt-list-item-view-model[role="listitem"]` with aria-label containing playlist name + "Selected"/"Not selected"
- New playlist title: `textarea[placeholder="Choose a title"]`
- New playlist visibility: `[role="combobox"]` → options are `yt-list-item-view-model[role="menuitem"]`
- Create button in dialog: `button[aria-label="Create"]`
- YouTube SPA navigation event: `yt-navigate-finish`

## GitHub
https://github.com/HarryTimp/YoutubePin
