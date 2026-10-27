# Brief for the board — CV Studio (second review, 27 Oct 2026)

This is the board's **second** review of the same business. The first review (25 Oct 2026) voted **3 × FUND IF, average 4.7/10** (Offers 5, Monopoly 4, Product 5). Its summary and conditions are reproduced at the end so you can judge what changed. Judge the business as it is now.

## The idea

- What it is: a mobile-first website (works on iPhone through the browser) and an Android app that helps a job seeker build a professional, up-to-date CV in French or English with AI, adapt it to each job offer, write the cover letter and interview preparation, and assemble and keep the paper documents a job application needs (scanner, single-PDF application file, document safe).
- Who it is for: job seekers in French-speaking West and Central Africa (Benin first, then Togo, Senegal, Côte d'Ivoire, Cameroon…): young graduates looking for a first job, workers changing jobs, candidates for public-service exams ("concours") and people applying abroad (Canada, France, Europe). Mostly on mobile phones, paying with Mobile Money (MTN MoMo, Moov Money).
- Where and how: online only. Site https://cv-studio-site.onrender.com, Android APK distributed directly (Play Store not yet published). Payment by Mobile Money through FedaPay (live). Acquisition planned through WhatsApp statuses, TikTok/Facebook videos (4 short vertical ads with voice-over already produced), and a referral programme.
- Budget and constraints: solo non-technical founder in Benin, working with an AI developer. Hosting 0 $/month (free tiers: Render static site, Supabase database and server function). AI paid per use (Anthropic API). FedaPay fee observed ~1.8 % (9 FCFA on 500). No custom domain yet, so no transactional email yet. Advertising budget not decided.

## Pricing (no subscription; 655.957 FCFA = 1 EUR)

Credit packs: 3 credits = 500 FCFA, 10 credits = 1,500 FCFA, 25 credits = 3,000 FCFA. 1 free credit at sign-up (once per device and once per internet connection per 30 days).

| What | Cost |
| --- | --- |
| Fill in the CV by hand, 3 basic templates, PDF with a small "Created with CV Studio" footer | Free, no account |
| Each AI action: generate the CV from messy text / voice / photos of an old paper CV or handwritten notes (several photos at once); correct it by voice; adapt to a job offer (with a before→after match score); cover letter; interview prep sheet; translation to English for US/UK/Canada norms; analysis of a template the user likes | 1 credit |
| "Pro version" of one CV, permanent for that CV: no footer, all 13 templates, Word export of the CV and its letter | 2 credits (the free sign-up credit is not enough: a first purchase is required) |
| Scanner: phone photos turned into a clean scanned PDF (shadows removed, 4-corner perspective correction) | Free up to 3 pages per PDF, then 1 credit for that PDF |
| Single-PDF application file: CV + letter + ID, diplomas… in the chosen order | Free with CV, letter and 2 documents, then 1 credit |
| Handwritten page → typed text (editable, then PDF or Word) | 1 credit per page |
| Questions the AI asks before adapting a CV to an offer | Free |
| Referral: invited friend's first purchase | +1 credit for each of the two |

## What has been built since the first review (all live in production)

- **Job offer by link or share**: paste the link of an offer, or tap "Share → CV Studio" from another app on Android; the server reads public job pages (job sites, LinkedIn job pages work; LinkedIn feed posts and WhatsApp links cannot be read and the app says so and asks for text or a screenshot). Before adapting, the AI asks 0 to 3 clarifying questions for free (which of several jobs in a post, whether the candidate has a required skill missing from the CV).
- **Scanner and application file** (described in the price table), document safe ("coffre-fort"): ID, diplomas, certificates kept on the phone, encrypted with an optional PIN; forgotten PIN can be reset through the account (copy of the key on the server, documents never leave the phone); one-tap "add to application file"; backup as one PDF. Online backup announced as "coming soon".
- **"My documents"**: every CV and every cover letter ever generated, by date, with search.
- **Monetisation changes**: Pro version raised from 1 to 2 credits so the free credit no longer unlocks it; free PDFs carry a footer; Word only in Pro; scanner and file limits; handwriting transcription as a paid service.
- **AI model switched** from Opus 5.5 to Sonnet 5.5: measured cost per action 7–18 FCFA (was 15–43 FCFA). Credits sell for 120–167 FCFA each.
- **Trust and support**: in-app "Contact us" chat with an admin console; testimonials ("I got the job") published only with consent after manual review; account recovery without email: a secret phrase or secret question set at sign-up, a recovery form checked automatically against the account (name, secret, last purchase, credits), validated by the admin in one tap, a temporary password sent into the user's chat.
- **Quality of life**: "Recommended" button that sets photo/birth date/nationality/signature to the usual norms for the CV's language, country and template; save files to the phone (folder picker) or share them; automatic CV language (a person writing in English gets an English CV); dictation in French or English.
- **Marketing assets**: 4 vertical ad videos (adapted CV, speak your CV, vs. ChatGPT, Canada) and a jobs/cities scrolling banner on the landing page (no fake company logos).

## Traction and evidence (honest)

- Paying users: 1 (the founder's own 500 FCFA test purchase, real money, through FedaPay live).
- One trusted tester uses the product for real (makes CVs and letters) and gives feedback; he was given 15 free credits.
- No paid advertising run yet; no conversion rate, no cost per acquisition measured; no verified testimonial yet.
- A domain name is not bought yet (planned: moncvstudio.com or cvstudio.africa, ~6,500 FCFA/year), so the site still lives on onrender.com.

## Competition (from the earlier competitor scan)

International: CVMove (cvmove.com), ~29.90 USD/month after a 14-day trial (job feed, adapted CV with match score, interview sheet, country rules). Free substitutes: Word/Canva templates, general AI chat assistants, cybercafé operators who type CVs for a fee, friends.

## Earlier CFO figures (before the model switch and the new price changes)

With Opus pricing: average pack sold 695 FCFA, contribution 352 FCFA (51 %) after AI, FedaPay and free credits; break-even 3 packs/day with 30,000 FCFA/month of ads. The CFO simulated that switching to Sonnet raises contribution to ~517 FCFA (74 %). Selling credits through Google Play billing (15 %) makes year 1 negative; the advice was to keep MoMo payment on the website.

## The first review's verdict, for comparison

Risks raised by several members: (1) unknown margin per action, (2) too many things and no single promise, (3) no proof and no distribution, (4) nothing prevents copying. Conditions it set:

- Measure real AI cost per action and prove a positive margin → since done (see above).
- Choose one main promise and one target customer (suggested: "your CV matched to the offer, with the before→after score").
- Never position as "the cheapest"; sell the outcome (the interview), not the document.
- Test named packs per segment ("Canada file", "Concours pack") well above 3,000 FCFA, with a clear guarantee.
- Get 20–30 real buyers, then 100 through a repeatable channel with a measured cost per acquisition.
- Collect at least 5 verified testimonials.
- Watch 10 real users do the full journey and fix each hesitation.
- Secure the journey: AI balance alert/auto-reload, clear pending-payment message, recover one's CV on another phone.
- Start a defensible asset: local concours and country rules, referrers (schools, cybercafés), a brand built on testimonials.

The first review's "strongest version": not "a CV generator for all of Africa" but "the CV that matches each offer" for young graduates and job seekers in French-speaking Africa, on mobile, with higher-value goal packs (Canada/Europe file, Concours pack) on top.
