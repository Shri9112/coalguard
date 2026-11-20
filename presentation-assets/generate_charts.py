"""Build presentation charts from CoalGuard V2's included evidence."""

from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch


ROOT = Path(__file__).resolve().parents[1]
OUT = Path(__file__).resolve().parent
DATA = ROOT / "lib" / "data" / "field-episodes.json"

NAVY = "#0b1220"
PANEL = "#111c2e"
GRID = "#334155"
TEXT = "#e2e8f0"
MUTED = "#a9b8cc"
CYAN = "#22d3ee"
BLUE = "#60a5fa"
GREEN = "#34d399"
AMBER = "#f59e0b"
RED = "#f87171"
PURPLE = "#c084fc"


def apply_dark_style() -> None:
    plt.rcParams.update({
        "figure.facecolor": NAVY,
        "axes.facecolor": PANEL,
        "axes.edgecolor": GRID,
        "axes.labelcolor": TEXT,
        "axes.titlecolor": TEXT,
        "text.color": TEXT,
        "xtick.color": MUTED,
        "ytick.color": MUTED,
        "grid.color": GRID,
        "font.family": "DejaVu Sans",
        "font.size": 10,
        "axes.titlesize": 12,
        "axes.labelsize": 10,
        "savefig.facecolor": NAVY,
        "savefig.edgecolor": NAVY,
    })


def save_figure(fig: plt.Figure, stem: str) -> None:
    fig.savefig(OUT / f"{stem}.png", dpi=220, bbox_inches="tight")
    fig.savefig(OUT / f"{stem}.svg", bbox_inches="tight")
    plt.close(fig)


def plot_field_episode() -> None:
    source = json.loads(DATA.read_text(encoding="utf-8"))
    episode = next(item for item in source["episodes"] if item["outcome"] == "fire")
    samples = episode["samples"]
    times = [datetime.strptime(row["timestamp"], "%Y-%m-%d %H:%M") for row in samples]
    confirmation = datetime.strptime(episode["confirmationAt"], "%Y-%m-%d %H:%M")

    csv_path = OUT / "mine-alpha-fire-episode.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=[
            "timestamp", "temperature_c", "co_ppm", "co2_percent",
            "o2_percent", "n2_percent", "methane_percent",
        ])
        writer.writeheader()
        for row in samples:
            writer.writerow({
                "timestamp": row["timestamp"],
                "temperature_c": row["temperatureC"],
                "co_ppm": row["coPpm"],
                "co2_percent": row["co2Percent"],
                "o2_percent": row["o2Percent"],
                "n2_percent": row["n2Percent"],
                "methane_percent": row["methanePercent"],
            })

    fig, (ax_temp, ax_co) = plt.subplots(2, 1, figsize=(10.5, 6.2), sharex=True,
                                         gridspec_kw={"height_ratios": [1, 1]})
    fig.suptitle("Published mine episode: temperature and CO measurements",
                 x=0.07, y=0.98, ha="left", fontsize=16, fontweight="bold")
    fig.text(0.07, 0.93,
             f"{episode['site']} · {episode['panelOrSeam']} · {episode['locationType']} · "
             f"180 readings at 4-hour intervals · confirmed fire",
             color=MUTED, fontsize=9.5)

    ax_temp.plot(times, [row["temperatureC"] for row in samples], color=AMBER,
                 linewidth=2.3, label="Measured temperature")
    ax_temp.set_ylabel("Temperature (°C)")
    ax_temp.grid(True, alpha=0.55)
    ax_temp.legend(loc="upper left", frameon=False, labelcolor=TEXT)

    ax_co.plot(times, [row["coPpm"] for row in samples], color=CYAN,
               linewidth=2.3, label="Measured CO")
    ax_co.set_ylabel("CO (ppm)")
    ax_co.set_xlabel("Source timestamp (timezone not specified)")
    ax_co.grid(True, alpha=0.55)
    ax_co.legend(loc="upper left", frameon=False, labelcolor=TEXT)

    for ax in (ax_temp, ax_co):
        ax.axvline(confirmation, color=RED, linewidth=1.5, linestyle=(0, (4, 3)))
    ax_temp.annotate("Recorded confirmation\n2025-10-22 14:00",
                     xy=(confirmation, episode["reportedMaximumTemperatureC"] * 0.72),
                     xytext=(8, 4), textcoords="offset points", color=RED,
                     fontsize=8, ha="left", va="bottom")
    ax_co.xaxis.set_major_locator(mdates.DayLocator(interval=5))
    ax_co.xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
    fig.text(0.07, 0.015,
             "Measured inputs only. No CoalGuard risk output is plotted. One episode; not conveyor validation.",
             color=MUTED, fontsize=8.5)
    fig.tight_layout(rect=(0.04, 0.05, 0.99, 0.9))
    save_figure(fig, "mine-alpha-fire-signals")


def plot_field_benchmark() -> None:
    methods = ["Basic\nMamdani", "PSO-tuned\nMamdani", "CO threshold\ncomparator"]
    colors = [CYAN, PURPLE, AMBER]
    detection = [1.0, 1.0, 1.0]
    false_alarm = [0.0, 0.0, 0.0]
    lead = [100, 108, 232]
    counts = [("3/3", "0/15"), ("3/3", "0/15"), ("3/3", "0/15")]

    with (OUT / "field-replay-comparison.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["method", "fire_episodes_alerted", "event_free_alarms", "median_lead_hours"])
        writer.writerows([
            ["Basic Mamdani", "3/3", "0/15", 100],
            ["PSO-tuned Mamdani", "3/3", "0/15", 108],
            ["Published CO threshold comparator", "3/3", "0/15", 232],
        ])

    fig, (ax_rate, ax_lead) = plt.subplots(1, 2, figsize=(10.5, 5.1),
                                            gridspec_kw={"width_ratios": [1.1, 1]})
    fig.suptitle("CoalGuard replay on published underground-mine episodes",
                 x=0.07, y=0.98, ha="left", fontsize=15, fontweight="bold")
    fig.text(0.07, 0.925,
             "CoalGuard recomputation · 3 confirmed fires · 15 event-free episodes · 24-hour persistence",
             color=MUTED, fontsize=9)

    x = range(len(methods))
    width = 0.32
    bars_detect = ax_rate.bar([i - width / 2 for i in x], detection, width,
                              color=colors, alpha=0.95, label="Fire episodes alerted")
    bars_false = ax_rate.bar([i + width / 2 for i in x], false_alarm, width,
                             color=colors, alpha=0.38, hatch="//", label="Event-free alarms")
    ax_rate.set_ylim(0, 1.24)
    ax_rate.set_yticks([0, .25, .5, .75, 1.0], ["0%", "25%", "50%", "75%", "100%"])
    ax_rate.set_xticks(list(x), methods)
    ax_rate.set_title("Episode counts")
    ax_rate.grid(axis="y", alpha=0.55)
    ax_rate.set_axisbelow(True)
    ax_rate.legend(loc="upper center", frameon=False, labelcolor=TEXT, fontsize=8)
    for i, (det, fp) in enumerate(counts):
        ax_rate.text(i - width / 2, 1.03, det, ha="center", va="bottom", color=TEXT,
                     fontsize=8, fontweight="bold")
        ax_rate.text(i + width / 2, 0.035, fp, ha="center", va="bottom", color=MUTED,
                     fontsize=8, fontweight="bold")

    bars = ax_lead.bar(methods, lead, color=colors, width=0.62)
    ax_lead.set_ylim(0, 280)
    ax_lead.set_ylabel("Median lead before confirmation (hours)")
    ax_lead.set_title("Warning lead time")
    ax_lead.grid(axis="y", alpha=0.55)
    ax_lead.set_axisbelow(True)
    for bar, value in zip(bars, lead):
        ax_lead.text(bar.get_x() + bar.get_width() / 2, value + 6, f"{value} h",
                     ha="center", va="bottom", color=TEXT, fontweight="bold")

    fig.text(0.07, 0.015,
             "Small exploratory sample. The CO comparator leads in this replay; counts do not establish general performance.",
             color=MUTED, fontsize=8.5)
    fig.tight_layout(rect=(0.04, 0.06, 0.99, 0.88))
    save_figure(fig, "field-replay-comparison")


def plot_pso_targets() -> None:
    labels = [
        "Mine: stable baseline",
        "Stockpile: early heating",
        "Conveyor: severe heating",
        "Conveyor: roller friction",
        "CHP: dust / steam",
        "Ship hold: deep smolder",
    ]
    values = [8, 48, 88, 52, 22, 82]
    colors = [GREEN, AMBER, RED, BLUE, PURPLE, RED]

    with (OUT / "pso-synthetic-targets.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["synthetic_training_example", "target_risk_index", "data_class"])
        writer.writerows([[label, value, "synthetic calibration target"] for label, value in zip(labels, values)])

    fig, ax = plt.subplots(figsize=(9.8, 4.8))
    fig.suptitle("PSO calibration examples: target risk labels",
                 x=0.08, y=0.98, ha="left", fontsize=15, fontweight="bold")
    fig.text(0.08, 0.92,
             "Six synthetic examples guide parameter search; these are labels, not measured model results.",
             color=MUTED, fontsize=9)
    y = list(range(len(labels)))
    bars = ax.barh(y, values, color=colors, height=0.62)
    ax.set_yticks(y, labels)
    ax.invert_yaxis()
    ax.set_xlim(0, 100)
    ax.set_xlabel("Target risk index (0–100)")
    ax.set_xticks([0, 25, 50, 75, 100])
    ax.grid(axis="x", alpha=0.55)
    ax.set_axisbelow(True)
    for bar, value in zip(bars, values):
        ax.text(value + 1.5, bar.get_y() + bar.get_height() / 2, str(value),
                va="center", ha="left", color=TEXT, fontweight="bold")
    fig.text(0.08, 0.02,
             "PSO tunes 11 selected membership/rule-weight parameters against this six-example synthetic set.",
             color=MUTED, fontsize=8.5)
    fig.tight_layout(rect=(0.05, 0.06, 0.99, 0.87))
    save_figure(fig, "pso-synthetic-targets")


def draw_box(ax: plt.Axes, xy: tuple[float, float], wh: tuple[float, float],
             title: str, body: str, edge: str, face: str = PANEL,
             title_size: int = 9) -> None:
    x, y = xy
    w, h = wh
    box = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.012,rounding_size=0.02",
                         linewidth=1.6, edgecolor=edge, facecolor=face)
    ax.add_patch(box)
    ax.text(x + w / 2, y + h * .68, title, ha="center", va="center",
            fontsize=title_size, fontweight="bold", color=TEXT, wrap=True)
    ax.text(x + w / 2, y + h * .30, body, ha="center", va="center",
            fontsize=7.5, color=MUTED, linespacing=1.25, wrap=True)


def arrow(ax: plt.Axes, start: tuple[float, float], end: tuple[float, float], color: str,
          style: str = "-|>", linestyle: str = "solid", mutation: int = 13) -> None:
    ax.add_patch(FancyArrowPatch(start, end, arrowstyle=style, mutation_scale=mutation,
                                 linewidth=1.6, linestyle=linestyle, color=color,
                                 connectionstyle="arc3,rad=0.0"))


def plot_processing_flow() -> None:
    fig, ax = plt.subplots(figsize=(12, 6.8))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    fig.suptitle("CoalGuard processing and evidence paths",
                 x=0.05, y=0.98, ha="left", fontsize=16, fontweight="bold")
    fig.text(0.05, 0.92,
             "The live profiles are simulated; calibration and published-data replay are separate paths.",
             color=MUTED, fontsize=9.5)

    xs = [0.035, 0.195, 0.355, 0.515, 0.675, 0.835]
    titles = ["Scenario &\ncontrols", "Profile\nprocess model", "Virtual\nsensors", "Evidence\naggregation", "Mamdani\nFIS", "Risk result &\nexplanation"]
    bodies = [
        "Profile · weather\nload · moisture · airflow",
        "Heat · gas · friction\naccumulation · cooling",
        "Readings + jitter\nhealth / stale / dropout",
        "Trends · sensor health\navailable signal agreement",
        "10 IF–THEN rules\nmin / max · centroid",
        "Index · stage · cause\nconfidence · action",
    ]
    colors = [BLUE, BLUE, CYAN, CYAN, PURPLE, GREEN]
    box_w, box_h, y = 0.13, 0.23, 0.58
    for x, title, body, color in zip(xs, titles, bodies, colors):
        draw_box(ax, (x, y), (box_w, box_h), title, body, color)
    for i in range(5):
        arrow(ax, (xs[i] + box_w + 0.005, y + box_h / 2),
              (xs[i + 1] - 0.008, y + box_h / 2), CYAN if i < 3 else BLUE)

    draw_box(ax, (0.10, 0.13), (0.34, 0.22),
             "Offline PSO calibration",
             "6 synthetic labelled examples · 11 selected parameters\n20 particles · 30 iterations · seed 42",
             AMBER, face="#2a2118", title_size=10)
    draw_box(ax, (0.56, 0.13), (0.34, 0.22),
             "Published underground-mine replay",
             "Measured temperature + CO + derived temperature trend\nOther sensor groups unavailable; kept separate from simulation",
             GREEN, face="#10251f", title_size=10)
    arrow(ax, (0.44, 0.245), (0.70, 0.575), AMBER, linestyle="dashed", mutation=14)
    arrow(ax, (0.72, 0.35), (0.74, 0.575), GREEN, linestyle="dashed", mutation=14)
    ax.text(0.535, 0.40, "tuned settings", color=AMBER, fontsize=7.5, rotation=42,
            ha="center", va="center")
    ax.text(0.76, 0.44, "separate data input", color=GREEN, fontsize=7.5,
            ha="left", va="center")

    fig.text(0.05, 0.035,
             "Decision-support demonstration only · no physical sensors, actuators, or safety controller are connected.",
             color=MUTED, fontsize=8.5)
    fig.tight_layout(rect=(0.02, 0.04, 0.99, 0.89))
    save_figure(fig, "coalguard-processing-flow")


def main() -> None:
    apply_dark_style()
    plot_field_episode()
    plot_field_benchmark()
    plot_pso_targets()
    plot_processing_flow()
    print(f"Created presentation charts in {OUT}")


if __name__ == "__main__":
    main()
