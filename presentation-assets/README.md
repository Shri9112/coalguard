# CoalGuard Research and Evaluation Assets

This folder contains reproducible figures and source-value tables used to explain CoalGuard's processing path and evaluate its research examples. Labels distinguish measured source data, CoalGuard replay calculations, and synthetic calibration examples.

| File | What it shows | Use |
|---|---|---|
| `mine-alpha-fire-signals.png` / `.svg` | Measured temperature and CO from one published Mine Alpha goaf fire episode; dashed line marks the source's recorded confirmation timestamp. It does not show CoalGuard's risk output. | Show how signals changed in a real recorded mine episode. |
| `field-replay-comparison.png` / `.svg` | CoalGuard's documented replay summary for 3 confirmed fires and 15 event-free episodes, using the same 24-hour persistence policy. | Compare episode counts and median warning lead in this small dataset. |
| `pso-synthetic-targets.png` / `.svg` | Six synthetic risk targets used by PSO calibration; these are target labels, not measured predictions. | Explain the limited training/calibration set and PSO's role. |
| `coalguard-processing-flow.png` / `.svg` | The live simulated inference path, offline PSO calibration path, and separate published-data replay path. | Explain the architecture and prevent confusion between simulated and measured data. |

CSV companions provide the plotted values: `mine-alpha-fire-episode.csv`, `field-replay-comparison.csv`, and `pso-synthetic-targets.csv`.

## Provenance

- Raw episode readings come from the adapted, attributed dataset at `../lib/data/field-episodes.json`; source and license details are in `../docs/REAL_DATA_REPLAY.md` and `../docs/EVIDENCE_NOTES.md`.
- Replay summary values match the documented CoalGuard replay results in `../docs/REAL_DATA_REPLAY.md`. They are exploratory observations from a small sample and do not establish general performance.
- PSO target examples match `../lib/engine/pso.ts` and are synthetic.
- These charts do not validate the five simulated profiles as industrial systems.

## Regenerate

With Python 3 and Matplotlib available, run from the project folder:

```bash
MPLCONFIGDIR=/tmp/coalguard-matplotlib MPLBACKEND=Agg python3 presentation-assets/generate_charts.py
```

The script reads the episode JSON and writes PNG, SVG, and CSV files into this folder.
