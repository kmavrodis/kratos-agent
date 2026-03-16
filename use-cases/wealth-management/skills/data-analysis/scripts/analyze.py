"""Data analysis helper — common pandas operations for the code_interpreter sandbox."""

from __future__ import annotations

import io
import json
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402


def profile(path: str) -> str:
    """Return a quick JSON profile of a CSV file."""
    df = pd.read_csv(path)
    info = {
        "rows": len(df),
        "columns": list(df.columns),
        "dtypes": {c: str(t) for c, t in df.dtypes.items()},
        "missing": df.isnull().sum().to_dict(),
        "numeric_summary": json.loads(df.describe().to_json()),
    }
    return json.dumps(info, indent=2)


def chart_bar(path: str, x: str, y: str, title: str = "Bar Chart", out: str = "/tmp/bar_chart.png") -> str:
    """Generate a bar chart from a CSV and save to disk."""
    df = pd.read_csv(path)
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.bar(df[x].astype(str), df[y])
    ax.set_xlabel(x)
    ax.set_ylabel(y)
    ax.set_title(title)
    plt.xticks(rotation=45, ha="right")
    plt.tight_layout()
    plt.savefig(out, dpi=150)
    plt.close()
    return out


def chart_line(path: str, x: str, y: str, title: str = "Line Chart", out: str = "/tmp/line_chart.png") -> str:
    """Generate a line chart from a CSV and save to disk."""
    df = pd.read_csv(path)
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(df[x], df[y], marker="o", linewidth=2)
    ax.set_xlabel(x)
    ax.set_ylabel(y)
    ax.set_title(title)
    plt.xticks(rotation=45, ha="right")
    plt.tight_layout()
    plt.savefig(out, dpi=150)
    plt.close()
    return out


def chart_histogram(path: str, column: str, bins: int = 20, title: str = "Histogram", out: str = "/tmp/histogram.png") -> str:
    """Generate a histogram from a CSV column and save to disk."""
    df = pd.read_csv(path)
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.hist(df[column].dropna(), bins=bins, edgecolor="black", alpha=0.7)
    ax.set_xlabel(column)
    ax.set_ylabel("Frequency")
    ax.set_title(title)
    plt.tight_layout()
    plt.savefig(out, dpi=150)
    plt.close()
    return out


def chart_correlation(path: str, title: str = "Correlation Matrix", out: str = "/tmp/correlation.png") -> str:
    """Generate a correlation heatmap for numeric columns."""
    df = pd.read_csv(path)
    numeric = df.select_dtypes(include="number")
    corr = numeric.corr()

    fig, ax = plt.subplots(figsize=(10, 8))
    im = ax.imshow(corr, cmap="RdBu_r", vmin=-1, vmax=1)
    ax.set_xticks(range(len(corr.columns)))
    ax.set_yticks(range(len(corr.columns)))
    ax.set_xticklabels(corr.columns, rotation=45, ha="right")
    ax.set_yticklabels(corr.columns)

    for i in range(len(corr)):
        for j in range(len(corr)):
            ax.text(j, i, f"{corr.iloc[i, j]:.2f}", ha="center", va="center", fontsize=8)

    fig.colorbar(im)
    ax.set_title(title)
    plt.tight_layout()
    plt.savefig(out, dpi=150)
    plt.close()
    return out


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: analyze.py <command> <csv_path> [args...]")
        sys.exit(1)

    cmd, csv_path = sys.argv[1], sys.argv[2]

    if cmd == "profile":
        print(profile(csv_path))
    elif cmd == "bar":
        x, y = sys.argv[3], sys.argv[4]
        title = sys.argv[5] if len(sys.argv) > 5 else "Bar Chart"
        print(f"Saved: {chart_bar(csv_path, x, y, title)}")
    elif cmd == "line":
        x, y = sys.argv[3], sys.argv[4]
        title = sys.argv[5] if len(sys.argv) > 5 else "Line Chart"
        print(f"Saved: {chart_line(csv_path, x, y, title)}")
    elif cmd == "histogram":
        col = sys.argv[3]
        title = sys.argv[4] if len(sys.argv) > 4 else "Histogram"
        print(f"Saved: {chart_histogram(csv_path, col, title=title)}")
    elif cmd == "correlation":
        title = sys.argv[3] if len(sys.argv) > 3 else "Correlation Matrix"
        print(f"Saved: {chart_correlation(csv_path, title)}")
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
