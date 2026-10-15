# Cœur Codé

- What it is: a two-player mobile word-duel game (secret-word guessing, letter by letter, hangman-style): each player picks a secret word, and the first to crack the other's word wins the round; rounds add up into a running "series" score.
- Who it is for: couples in a long-distance relationship (stated in the privacy policy: "pensé pour les couples à distance"), French-speaking first, English also supported.
- What it sells, at what price: today nothing — free, no ads, no account. The business model is NOT decided yet (options: paid app, free + premium, subscription).
- Where and how: online. A single-file web app (PWA) wrapped with Capacitor for Android and iOS (build pipeline on Codemagic). Not published on any store yet. Game state stored on a third-party free JSON store (MantleDB) under a random 5-character game code. How customers will find it: not decided.
- Budget and constraints: almost no money (under ~100 €) and a few hours per week. Solo developer.
