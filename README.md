# Follow Your Eye

**For judges:** Follow Your Eye is an art discovery web app by **Vincent Liu**. At [vincentliu.ai](https://vincentliu.ai/), anyone curious about art can choose between two paintings in a ten-pair round, then see how their preferences compare with precomputed AI judges. To try it, open the site, choose either painting or skip each pair, and continue to the round result. The [AI use and authorship note](#ai-use-and-authorship) below explains the AI judges, model predictions and image sources. The [development log](devlog.md) records the work over time.

**Find the code quickly:** `web/index.html`, `web/app.js`, `web/experience-core.mjs` and `web/style.css` implement the web experience; `tests/` contains checks. The public dataset and metadata are in `web/*.json` and `Data/`. The 5,326 optimized museum images are in `web/met-art/`; historical images are in `web/art/`. These images account for most repository files and download size, so start with the source files above if you are reviewing the implementation.

## Current public dataset

- `follow-your-eye-met-paintings-v3`: 2,751 evaluated pairs and a searchable gallery of 5,326 verified Met Open Access Paintings. New rounds draw from 1,200 existing pairs with a matching broad medium and similar measured visual features; `Data/build_style_matched_pairs.py` reproduces `web/met_style_matched_pairs.json`. This narrows stark visual mismatches without changing pair IDs, AI results, or historical records. New ten-pair rounds prefer seven pairs in which both works belong to Western-focused Met curatorial departments, and the first three positions draw from 14 manually reviewed pairs in that group while unused ones remain. The gallery's opening browse order similarly favors Western-department works without hiding any other artwork. The Met department snapshot is `Data/met_department_snapshot_v1.json`; `Data/build_western_artwork_ids.py` generates `web/met_western_artworks.json`. This is a presentation choice based on museum departments, not a claim that every artwork has a single cultural identity. The 2,273 newer evaluated pairs have six AI-judge votes and numerical feature-model predictions. A second image review removed 109 unsuitable pairs from the previous 2,860-pair catalog. See `Data/met_quality_review_v2.json` for the exclusions and `web/about.html` for limits of the style filter.
- Paintings can be opened and zoomed in the choice view, result page, personal collection, and Met gallery. The result page shows separate choice agreement percentages for the AI judges and feature model, with each chosen artwork's direct Met collection link visible.
- The result page also shows Cohen’s kappa for this round against the weighted AI-judge preference and the feature model. It uses the same comparable, non-skipped pairs as the percentages and adjusts for the A/B choice frequencies observed in that round. A ten-pair round is too small for a firm interpretation; the statistic is unavailable when chance agreement has a zero denominator.
- The About page displays a dated aggregate snapshot: Fleiss’ kappa across six judges on 2,272 evaluated new pairs, each judge’s repeat and swapped-position consistency, and Cohen’s kappa between saved choices and the weighted AI preference or feature model. It also separates the visitor/AI comparison across the original study and two newer rating batches. A separate live counter reads the current production, non-skip choice total from the collector every 30 seconds while the page is visible. Counts are saved choices, not verified visitors; kappa and its interval remain dated snapshots.
- On the result page, either agreement tile opens the per-pair comparison and highlights the selected AI column. A next-round button sits beside a share action beneath the result sentence; the original next-round card remains at the bottom. Sharing sends or copies the current round sentence with `?source=share`.
- Historical app data and 106 web thumbnails remain in this repository and are not mixed with current results.
- `web/met_experience_data.json`, `web/met_catalog.json` and `web/met-art/` supply the public experience. The 5,326 resized JPEGs are derived from Met Open Access images; the full originals and model checkpoints are not part of the website.

The web site is static and published from `web/` by GitHub Pages.

## AI use and authorship

Vincent Liu is the named project author. The six AI judges' painting preferences were generated before publication using OpenAI and Anthropic models; a separate numerical feature model produces its own pair predictions. Playing a round does not call an AI model. The museum images and artwork metadata come from The Met Open Access. Codex assisted with implementing and checking the October 2026 kappa analysis and website display. The CAC submission should disclose this assistance and accurately identify the technical work Vincent personally completed and can explain.

## Agreement snapshot

The public `web/agreement_stats.json` contains aggregate statistics only. `tools/agreement_stats.py` computes it from the saved six-judge votes and a private production-choice CSV exported by the owner. It reports 15 pairwise judge comparisons as well as Fleiss’ kappa, repeat consistency, left/right-swap consistency, three rating-batch comparisons, and visitor comparisons with 95% percentile intervals from 10,000 resamples of anonymous browser sessions. A swapped A/B vote is reversed back to the same artwork before comparison. The visitor comparisons exclude skips and exact prediction ties. The snapshot is updated manually when the script is rerun; the live count is a separate public aggregate query. The October 14 snapshot includes sessions whose timing records are inconsistent with the normal sequential page flow; this is disclosed on the About page and is not evidence of who or what submitted them.

To refresh the snapshot, run `python3 tools/agreement_stats.py --human-csv /path/to/private-choices.csv --output web/agreement_stats.json` with a privately prepared export. The displayed numbers are descriptive; anonymous sessions are not verified people, and repeated choices and pair exposure limit inference.

## Local checks

```sh
node --test tests/experience-core.test.mjs tests/experience-storage.test.mjs tests/experience-connectivity.test.mjs tests/met-experience.test.mjs
python3 -m unittest discover -s tests -p 'test_agreement_stats.py'
```

Serve `web/` over HTTP for a browser preview. The next pair pauses after a failed request and offers a retry.

## Publishing

Check the web experience and its data files before publishing `web/`.

The public website does not call an AI model when a visitor chooses. Its AI judgments were computed in advance.

## Historical work

The project began as a fixed 60-pair classroom exercise. Its data processing, three-feature comparison, round results and development history are recorded in `devlog.md` and `verification.txt`. A separate private test site was used to build and check the ten-choice experience, bilingual interface, larger Met gallery, expanded AI ratings and visual screening before those features reached the public site.
