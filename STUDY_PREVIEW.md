# Follow Your Eye study-flow preview

`web/study-preview/` is a separate, unlisted, noindex page showing a proposed 50-pair adult study with 15 pair positions per session, five background questions and English/Chinese branches. It does not replace the existing public 10-pair art experience. It stores no answers, uploads no choices, issues no Prolific completion code and cannot enroll participants.

The preview provides a link to enlarge each artwork and an Exit control during the instruction, painting-pair and questionnaire stages. Exit discards the page's in-memory choices.

The 50 pairs are a reproducible AI-assisted preliminary shortlist from the existing 100-pair candidate bank. `tools/build_study_preview_bank.py` documents the conservative hint filter and period quotas. The shortlist is **not** PI-approved image screening. The five-judge prediction freeze is scheduled after CSSRA approval and before any new study data collection. The page deliberately shows no agreement percentage until valid frozen AI predictions exist. The source images are already hosted at `web/met-art/`.

The displayed consent is a review preview. The preview now describes the proposed payment, data-separation, retention and AI-freeze rules. The Prolific researcher account remains registered to Chenglin Liu while Juan Wang would manage and review study payments; actual Prolific prescreener wording and return URLs, measured duration/reward, data collection and deletion implementation, final PI approval and independent bilingual review are still pending. Do not invite participants to this page or describe it as an approved study.

Run `node --test tests/study-preview.test.mjs` from the repository root. For local visual review, serve `web/` with an HTTP server and open `/study-preview/`.
