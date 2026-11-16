# Brief for the board — CVCasa (third review, 16 Nov 2026)

This is the board's **third** review of the same business. The first two (25 and 27 Oct 2026) both voted **3 × FUND IF, average 4.7/10** (Offers 5, Monopoly 4, Product 5). The second review's risks and conditions are reproduced at the end so you can judge what changed in the three weeks since. Judge the business as it is now; do not reward effort, reward evidence.

## The idea

- What it is: a mobile-first website (cvcasa.com, works on iPhone in the browser) and an Android app that turns a job seeker's old CV (PDF, Word, photos of a paper CV), a few messy lines or their voice into a clean, up-to-date CV; adapts it to each job offer with a before→after match score; writes the cover letter; and helps with the rest of the application (interview sheet, ready-to-copy application email, scanner and single-PDF application file, follow-up reminders, daily job alerts by email).
- Who it is for: job seekers in French-speaking West and Central Africa (Benin first, then Togo, Côte d'Ivoire, Senegal, Niger, Cameroon): young graduates, people changing jobs, public-exam ("concours") candidates, people applying abroad. Mostly on mobile phones, paying with Mobile Money. The interface is also in English and shows prices in the visitor's currency.
- Where and how: online only. Site https://cvcasa.com (own domain, bought since the second review). Android APK distributed directly (not on the Play Store); web changes reach the app automatically without a new install. Payment: Mobile Money through FedaPay (Benin, Togo, Côte d'Ivoire MTN, Senegal Free, Niger Airtel), or USDT/USDC on the BEP20 network, verified on the blockchain (used automatically outside the FCFA zone). Card payment announced as "coming soon".
- Team and budget: solo non-technical founder in Benin, working with an AI developer. Hosting on free tiers (Render static site, Supabase database and server function). AI paid per use (Anthropic API, measured 7–18 FCFA per action). No advertising budget decided.

## Pricing (no subscription; 655.957 FCFA = 1 EUR)

Credit packs: Essentiel 3 credits = 500 FCFA, Candidatures 10 = 1,500 FCFA, Recherche intensive 25 = 3,000 FCFA. **Launch offer until 31 Dec 2026**: 5 / 16 / 35 credits for the same prices. 1 free credit at sign-up. A one-time "come-back offer" (4 credits for 500 FCFA, 72 hours) is shown to people who have not bought after a while.

| What | Cost |
| --- | --- |
| Fill in the CV, choose among the free templates, download the PDF (small "Created with CVCasa" footer) | Free |
| One AI action: generate or improve the CV, adapt it to an offer (with score), cover letter, interview sheet, translation | 1 credit |
| Pro version of one CV, forever: no footer, all ~33 templates, Word export | 2 credits |
| Scanner or application PDF beyond 2 pages / 2 documents | 1 credit |
| Handwritten page typed out | 1 credit |
| Free: keyword check of the CV against an offer, clarifying questions before adapting or writing the letter, application email, follow-up reminders, sharing the CV by link and QR code, "write like me" style profile, "natural writing" review | Free |
| Daily job alerts by email ("veille emploi") | first search free, then credits |

Referral: when a friend makes a first purchase, both get credits. Ambassador programme (Africa only): people who sign a contract online earn a commission on purchases made by people they bring, paid by Mobile Money.

## What changed since the second review (27 Oct → 16 Nov)

- **Name and domain**: renamed CVCasa, now on cvcasa.com (was a onrender.com address), with transactional email.
- **Payments**: crypto (USDT/USDC BEP20) added and working (one real payment by the founder, credited automatically after on-chain check); a customer can now cancel an unpaid crypto order. Prices shown in local currency per country.
- **Offer**: launch offer (+60–70 % credits until 31 Dec), come-back offer, ambassador programme.
- **Product**: English interface; ~33 templates (free and Pro) that fit on one page; Word import; job alerts by email; share CV by link/QR; application email; follow-up reminders; professional photo background clean-up; free keyword checker; accept the AI's changes one by one; "write like me".
- **Simplification after tester feedback** (this week): a "What now?" step guide after each step (shown the first 3 times), lighter pages with optional tools folded away, clear "where to download" banners, a "Start with your CV" card that blocks adapting an empty CV (the server also refuses it and charges nothing), dark mode.
- **Reliability**: two real testers found real problems (Android file import, an empty CV being adapted and still charged, a crash when leaving a screen); all were fixed or guarded the same day, and AI calls are now logged (without personal data) to diagnose incomplete results.
- **Marketing assets**: 4 short vertical videos with voice-over, a landing page with a photo story and real template previews, SEO guide pages (CV by job: accountant, IT, nurse…; by country: Benin, Senegal, Côte d'Ivoire…).

## Traction and evidence (honest, from the production database on 16 Nov 2026)

- Accounts: **6 in total** (3 created in the last 7 days). All signed up with no tracked source.
- Paying customers: **0 besides the founder**. The only two paid orders are the founder's own tests (500 FCFA by Mobile Money on 25 Oct, 1,500 FCFA by crypto on 14 Nov). One other person started a Mobile Money payment and let it expire.
- Two testers were given free credits (10 and 15 + 10, with an automatic withdrawal of 1 credit every 3 days so they do not hoard them). They used the product for real: 8 CV generations, 10 adaptations, 7 cover letters, 3 Pro unlocks across all accounts.
- Site visits in the last 30 days: about 172, almost all "direct" (no ad campaign, no tracked channel).
- Testimonials: 0. Ambassadors signed: 1 (a tester). Job alerts created: 0.
- No ad has been run; no conversion rate or cost per acquisition is measured.

## Competition (from the earlier competitor scan, unchanged)

International: CVMove (~29.90 USD/month after a 14-day trial: job feed, adapted CV with match score, interview sheet). Free substitutes: Word/Canva templates, general AI chat assistants, cybercafé operators who type CVs for a fee, friends.

## Earlier CFO figures (unchanged)

Credits sell for 120–167 FCFA each (less during the launch offer: ~86–100 FCFA); AI costs 7–18 FCFA per action; FedaPay fee ~1.8 %. Earlier simulation: contribution ~517 FCFA per average pack (~74 %) with the cheaper model; selling through Google Play billing (15 %) would make year 1 negative.

## The second review's verdict, for comparison

Risks raised by several members: (1) no proof and no channel; (2) dispersion got worse (five features added instead of choosing one promise); (3) price grid too complicated, selling "credits" instead of a result; (4) trust gaps (onrender.com address, no email, manual account recovery); (5) nothing prevents copying (only local knowledge and a testimonial-based brand could defend it).

Conditions it set:
- Watch 10 real people without free credits go through the whole path, from a video to the Mobile Money receipt; fix every hesitation.
- Measure one channel's cost per acquisition before spending on ads; get the first verified testimonials.
- Choose one promise and one customer; cut or hide what does not serve it.
- Simplify the price grid; sell a result (a ready application) rather than credits; test a named pack per segment.
- Buy a domain and email; make the document-safe wording exact.
