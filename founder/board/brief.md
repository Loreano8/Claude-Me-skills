# Board brief — Cœur Codé

Source: the founder's GitHub repo (Loreano8/coeur-code) plus three answers the founder gave. Everything below is fact from the code or the founder; nothing here is an opinion about the idea.

## The idea (founder/idea.md)

- **What it is:** a two-player mobile word-duel game. Each player chooses a secret word (3–15 letters, no accents/spaces). Players take turns proposing letters to uncover the other's word, hangman-style; the first to crack the other's word wins the round. Rounds accumulate into a "series" score with a round history.
- **Who it is for:** couples in a long-distance relationship (the privacy policy says the game is "pensé pour les couples à distance"). French first; English fully translated.
- **What it sells, at what price:** nothing yet. Free, no ads, no tracking, no account. **Business model not decided** (paid app, free + premium, or subscription are all open).
- **Where and how:** online / mobile. **Not yet published** on Google Play or the App Store.
- **Budget and constraints:** almost no money (< ~100 €), a few hours per week, solo developer.

## What the product already does (from the code)

- Single `index.html` (~100 KB) web app + service worker (installable PWA), wrapped with Capacitor 8 for Android and iOS; Codemagic CI config present; app id `com.loreano.coeurcode`; custom heart icon.
- **Play modes:** (1) private game with a partner via a 5-character code; (2) random matchmaking with a stranger (a shared queue); (3) solo vs. the computer with Easy / Normal / Hard difficulty (AI guesses by letter frequency).
- **Social mechanics:** ask your partner for a hint (in some states the partner *owes* a hint and cannot refuse), request a pause, turn timer, "it's your turn" banner, live updates while staying on screen. Deliberately "no messaging — just the word game".
- **Content:** built-in word lists with definitions in FR and EN, words grouped into 7 themes (nature, food, travel, home, jobs, sports, emotions); "see the definition" of the word after a round; accent handling for French letters.
- **Polish:** generated music/sound (setup, playing, victory and defeat jingles), sound toggle, name remembered on device, "resume game" button.
- **Backend:** none of its own. Game state lives on MantleDB, a free public no-account JSON store, under the 5-character code; the privacy policy warns that anyone with the code could read it. No accounts, no push notifications found in the code.
- **Privacy policy** page exists (FR), updated August 2026: no ads, no ad tracking, no location or contacts.

## Not known (do not invent)

Market size, number of long-distance couples reachable, competitor list and prices, cost to acquire a player, retention, any user numbers (none — unpublished), store fees beyond the standard developer accounts.
