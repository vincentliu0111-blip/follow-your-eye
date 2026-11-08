# Follow Your Eye

**For judges:** Follow Your Eye is an art discovery web app by **Vincent Liu**. At [vincentliu.ai](https://vincentliu.ai/), anyone curious about art can choose between two paintings in a ten-pair round, then see how their preferences compare with precomputed AI judges. In this version, adults must explicitly agree before choosing; anyone can browse the gallery. After enrollment, choose either painting or skip each pair, then continue to the round result. Formal research participation stays closed until its start is configured. The [AI use and authorship note](#ai-use-and-authorship) below explains the AI judges, model predictions and image sources. The [development log](devlog.md) records the work over time.

**Find the code quickly:** `web/index.html`, `web/app.js`, `web/experience-core.mjs` and `web/style.css` implement the web experience; `tests/` contains checks. The public dataset and metadata are in `web/*.json` and `Data/`. The 5,326 optimized museum images are in `web/met-art/`; historical images are in `web/art/`. These images account for most repository files and download size, so start with the source files above if you are reviewing the implementation.

## Explicit research participation

The November 7 version adds bilingual study information before painting choices, separate adult-volunteer and gallery buttons, persistent research details/contact links, and skip/exit controls. No click, keyboard shortcut, artwork link, shared link or legacy `consent: true` establishes study consent. The old checkbox and automatic collection are removed. The contact is vincentliu0111@gmail.com. Formal research is not open and this version does not claim IRB approval or exemption. Its estimated 3–5 minute duration still needs a human timing check before opening.

`web/study-client.mjs` uses a separate outbox and server-created study session. The service records adult confirmation, UTC consent time, notice version and notice language. Old histories remain local; old pending queues are discarded from upload. Research answers contain event/session/round references, question order, pair and actual left/right/selected artwork IDs or skip, display/choice times, server receipt time and dataset/protocol versions. Optional personal preferences and entry source remain local. The session token is sent only as authorization, never in URLs or the answer payload.

Withdrawal stops new answers and cancels the unsent outbox immediately. Durable end markers and cross-tab coordination prevent resumed uploads, including after an offline exit; the pending exit/deletion request is retried when online. Already submitted answers are retained unless deleted using the session access held by the browser. The gallery and About page provide this deletion action. Active-database deletion excludes answers from future exports and live totals; published aggregates and downloaded copies need separate handling. New study records are removed one year (365 days) after the configured study end. Provider backup/log retention must be verified separately.

The private study backend rejects the legacy write route, validates study access and event identity, deduplicates retries and uses one eligibility view for paper CSV and public counts. Production enrollment stays closed while `study_start_at` is unset. Pre-end answers may arrive later and are judged by `chosen_at`, not receipt time. Local preview sessions are test-only and never enter formal-study exports/counts. The backend migration preserves historical tables without backfilling consent. A frozen configuration records actual sampler sources, judge weights, model versions, predictions and file fingerprints. Codex assisted with implementation and checks.

## Current public dataset

- `follow-your-eye-met-paintings-v3`: 2,751 evaluated pairs and a searchable gallery of 5,326 verified Met Open Access Paintings. New rounds draw from 1,200 existing pairs with a matching broad medium and similar measured visual features; `Data/build_style_matched_pairs.py` reproduces `web/met_style_matched_pairs.json`. This narrows stark visual mismatches without changing pair IDs, AI results, or historical records. New ten-pair rounds prefer seven pairs in which both works belong to Western-focused Met curatorial departments, and the first three positions draw from 14 manually reviewed pairs in that group while unused ones remain. The gallery's opening browse order similarly favors Western-department works without hiding any other artwork. The Met department snapshot is `Data/met_department_snapshot_v1.json`; `Data/build_western_artwork_ids.py` generates `web/met_western_artworks.json`. This is a presentation choice based on museum departments, not a claim that every artwork has a single cultural identity. The 2,273 newer evaluated pairs have six AI-judge votes and numerical feature-model predictions. A second image review removed 109 unsuitable pairs from the previous 2,860-pair catalog. See `Data/met_quality_review_v2.json` for the exclusions and `web/about.html` for limits of the style filter.
- Paintings can be opened and zoomed in the choice view, result page, personal collection, and Met gallery. The result page shows separate choice agreement percentages for the AI judges and feature model, with each chosen artwork's direct Met collection link visible.
- The result page also shows Cohen’s kappa for this round against the weighted AI-judge preference and the feature model. It uses the same comparable, non-skipped pairs as the percentages and adjusts for the A/B choice frequencies observed in that round. A ten-pair round is too small for a firm interpretation; the statistic is unavailable when chance agreement has a zero denominator.
- The About page retains the dated AI-only baseline. Historical visitor snapshots remain source artifacts and are not presented as formal-study results. Eligible formal-study public totals use the shared consent/time rule. Historical snapshot contents: Fleiss’ kappa across six judges on 2,272 evaluated new pairs, each judge’s repeat and swapped-position consistency, and Cohen’s kappa between saved choices and the weighted AI preference or feature model. Historical visitor figures are hidden in this version; the live counter includes only eligible non-skip formal-study answers, not distinct people.
- On the result page, either agreement tile opens the per-pair comparison and highlights the selected AI column. A next-round button sits beside a share action beneath the result sentence; the original next-round card remains at the bottom. Sharing sends or copies the current round sentence with `?source=share`.
- Historical app data and 106 web thumbnails remain in this repository and are not mixed with current results.
- `web/met_experience_data.json`, `web/met_catalog.json` and `web/met-art/` supply the public experience. The 5,326 resized JPEGs are derived from Met Open Access images; the full originals and model checkpoints are not part of the website.

The web site is static and published from `web/` by GitHub Pages.

## AI use and authorship

Vincent Liu is the named project author. The six AI judges' painting preferences were generated before publication using OpenAI and Anthropic models; a separate numerical feature model produces its own pair predictions. Playing a round does not call an AI model. The museum images and artwork metadata come from The Met Open Access. Codex assisted with implementing and checking the October 2026 kappa analysis and website display. The CAC submission should disclose this assistance and accurately identify the technical work Vincent personally completed and can explain.

## Agreement snapshot

The public `web/agreement_stats.json` contains aggregate statistics only. `tools/agreement_stats.py` computes it from the saved six-judge votes and a private production-choice CSV exported by the owner. It reports 15 pairwise judge comparisons as well as Fleiss’ kappa, repeat consistency, left/right-swap consistency, three rating-batch comparisons, and visitor comparisons with 95% percentile intervals from 10,000 resamples of browser sessions identified by random IDs. A swapped A/B vote is reversed back to the same artwork before comparison. The visitor comparisons exclude skips and exact prediction ties. The snapshot is updated manually when the script is rerun; the live count is a separate public aggregate query. The October 14 snapshot is historical exploratory material, includes timing anomalies, and is not evidence of who submitted it or of valid formal-study consent. It is not displayed as the new formal-study result.

To refresh the snapshot, run `python3 tools/agreement_stats.py --human-csv /path/to/private-choices.csv --output web/agreement_stats.json` with a privately prepared export. Historical snapshot numbers are descriptive and must not substitute for a new eligible study export; browser sessions are not verified people, and repeated choices and pair exposure limit inference.

## Artwork discovery and connectivity

Forty static artwork pages at `/artworks/` are generated from the existing Met catalog and an explicit selection in `Data/artwork_page_selection.json`. Each has source metadata, a looking exercise, a canonical URL, structured data, related links, and an entry to an already evaluated comparison containing that work. Generate with `node tools/build_artwork_pages.mjs`; verify with `node tools/build_artwork_pages.mjs --check`. These pages are in the sitemap; search ranking and indexing are not guaranteed. Descriptive metadata preserves the museum's uncertainty; looking prompts are editorial exercises, not museum commentary.

An artwork link preserves an unfinished round and starts the requested work in the next round. Entry source is kept in local round history; it is not included in the minimized research payload. The realized pair order and left/right IDs are recorded for reconstruction. Reloading the same entry does not keep scheduling it again.

`/connection.html` performs read-only configuration and public-count connectivity checks, without sending a choice or registering a test session. A successful check does not prove POST writes or mainland-China reachability. this version retires legacy automatic collection and uses the explicit-consent study service. Mainland upload availability requires tests from actual local networks; merely changing to a custom domain is not a verified fix.

## Focused search guides

Five existing English artwork pages now have museum-sourced context and work-specific looking exercises: Met IDs 436528, 436526, 435868, 437881 and 437301. Their Chinese editions live at `/zh/artworks/met-<ID>/`; Chinese titles are site translations rather than claimed official museum labels. The source URLs, verification date and bilingual editorial live in `Data/artwork_editorial_v1.json`. Museum background is distinguished from site observations. Codex assisted in drafting and checking this editorial against the museum records and the existing artwork images.

The English `/art-choices/` and Chinese `/zh/art-choices/` pages explain how to compare paintings and interpret the saved AI preferences. They link to the five works and the existing experience. `Data/art_choice_guides_v1.json` is their content source. All seven new URLs have independent canonicals and reciprocal language annotations; the sitemap now contains 51 URLs. Generation and verification use the existing `tools/build_artwork_pages.mjs` command. Search inclusion and ranking are not guaranteed.

Guide links pass a supported `lang=en` or `lang=zh` value to set the interactive UI language. The link itself only updates the language setting. Local choice history is preserved; legacy outboxes are retired when the new study experience restores them. Focused artwork return links follow the interface language. General guide source attribution still applies primarily to new browser sessions; an existing session is not silently relabeled. Re-entering the current work can replace a different queued next-work request without discarding round progress.

## Local checks

```sh
node --test tests/experience-core.test.mjs tests/experience-storage.test.mjs tests/experience-connectivity.test.mjs tests/met-experience.test.mjs tests/artwork-pages.test.mjs tests/search-content.test.mjs
python3 -m unittest discover -s tests -p 'test_agreement_stats.py'
```

Serve `web/` together with the matching local study service for an interactive preview; a static-only server leaves formal participation closed. Only explicit study participants have a research outbox. Connection failures preserve event IDs and actual choice times. New participation requires working browser storage. The study service and one-year purge must be tested separately from frontend checks; no local preview is a production deployment.

## Publishing

Check the web experience and its data files before publishing `web/`.

The public website does not call an AI model when a visitor chooses. Its AI judgments were computed in advance.

## Historical work

The project began as a fixed 60-pair classroom exercise. Its data processing, three-feature comparison, round results and development history are recorded in `devlog.md` and `verification.txt`. A separate private test site was used to build and check the ten-choice experience, bilingual interface, larger Met gallery, expanded AI ratings and visual screening before those features reached the public site.
