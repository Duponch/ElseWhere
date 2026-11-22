"""Calibrate freshly generated SFX takes (requires soundfile, numpy, scipy, imageio-ffmpeg).

For every raw take of a tagged lot (e.g. ``c1122``) listed in the generation log:
trim the leading and trailing silence, add short fades, attenuate a take whose
peak exceeds -1 dBFS, encode it once at the published format (MP3 128 kb/s,
44.1 kHz, stereo) and measure the encoded result. The variant gain written to
the manifest brings the take to its family target RMS, unless its peak after
gain would cross the family ceiling (then the ceiling decides). The event gain
stays 1, so the effective gain of a take is its variant gain.

Measures (decoded PCM, all samples): peak dBFS, RMS dBFS over the active span
(first to last sample above -50 dBFS), ungated K-weighted loudness (BS.1770
filters, no gating: most cues are shorter than one 400 ms gating block),
spectral centroid. This is arithmetic balance, not a human listening proof.

Usage:
  python scripts/audio/calibrate-sfx.py --tag c1122               # report only
  python scripts/audio/calibrate-sfx.py --tag c1122 --write \
      --balance scripts/audio/pcm-balance-20261122.json [--reject a.mp3,b.mp3 --reject-reason "..."]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

import imageio_ffmpeg
import numpy as np
import soundfile as sf
from scipy.signal import lfilter

REPO = Path(__file__).resolve().parents[2]
SFX = REPO / "public/assets/audio/sfx"
SILENCE_DBFS = -50.0
RAW_PEAK_CEILING_DBFS = -1.5
PRE_ROLL_S, POST_ROLL_S = 0.004, 0.040
FADE_IN_S, FADE_OUT_S = 0.003, 0.025

# Family targets: effective RMS (dBFS, active span) and peak ceiling after gain.
# World SFX keep the V175 rule (-23 RMS, peak <= -4); interface cues are not
# attenuated by distance, so they sit lower: notifications 4-6 dB under the
# world target, small controls 9 dB under it (the V165 clicks sit near -34.5).
FAMILIES = {
    "world": {"targetRmsDbfs": -23.0, "peakCeilingDbfs": -4.0},
    "notify-strong": {"targetRmsDbfs": -27.0, "peakCeilingDbfs": -6.0},
    "notify": {"targetRmsDbfs": -29.0, "peakCeilingDbfs": -7.0},
    "ui": {"targetRmsDbfs": -32.0, "peakCeilingDbfs": -8.0},
}
STRONG = {"letter.threat-big", "alert.critical"}
NOTIFY_PREFIXES = ("letter.", "alert.", "tutorial.", "quest.")
NOTIFY = {"ui.research-complete", "ui.colonist-downed", "ui.trade-open", "ui.trade-execute"}


def family_of(cue: str, spatial: bool) -> str:
    if spatial:
        return "world"
    if cue in STRONG:
        return "notify-strong"
    if cue in NOTIFY or cue.startswith(NOTIFY_PREFIXES):
        return "notify"
    return "ui"


def db(value: float) -> float:
    return 20 * np.log10(max(value, 1e-12))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def active_span(samples: np.ndarray) -> tuple[int, int]:
    magnitude = np.abs(samples).max(axis=1)
    above = np.nonzero(magnitude > 10 ** (SILENCE_DBFS / 20))[0]
    if not len(above):
        return 0, len(samples)
    return int(above[0]), int(above[-1]) + 1


def k_weighting(rate: int) -> list[tuple[np.ndarray, np.ndarray]]:
    """BS.1770 pre-filter (high shelf +4 dB at 1.5 kHz) and RLB high-pass (38 Hz)."""
    def shelf(f0: float, gain_db: float, q: float):
        a = 10 ** (gain_db / 40)
        w0 = 2 * np.pi * f0 / rate
        alpha = np.sin(w0) / (2 * q)
        cos = np.cos(w0)
        b = [a * ((a + 1) + (a - 1) * cos + 2 * np.sqrt(a) * alpha),
             -2 * a * ((a - 1) + (a + 1) * cos),
             a * ((a + 1) + (a - 1) * cos - 2 * np.sqrt(a) * alpha)]
        den = [(a + 1) - (a - 1) * cos + 2 * np.sqrt(a) * alpha,
               2 * ((a - 1) - (a + 1) * cos),
               (a + 1) - (a - 1) * cos - 2 * np.sqrt(a) * alpha]
        return np.array(b) / den[0], np.array(den) / den[0]

    def highpass(f0: float, q: float):
        w0 = 2 * np.pi * f0 / rate
        alpha = np.sin(w0) / (2 * q)
        cos = np.cos(w0)
        b = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]
        den = [1 + alpha, -2 * cos, 1 - alpha]
        return np.array(b) / den[0], np.array(den) / den[0]

    return [shelf(1681.974450955533, 3.999843853973347, 0.7071752369554196),
            highpass(38.13547087602444, 0.5003270373238773)]


def measure(samples: np.ndarray, rate: int) -> dict[str, float]:
    start, end = active_span(samples)
    active = samples[start:end].astype(np.float64)
    weighted = active
    for b, a in k_weighting(rate):
        weighted = lfilter(b, a, weighted, axis=0)
    power = float(np.sum(np.mean(np.square(weighted), axis=0)))
    mono = active.mean(axis=1)
    spectrum = np.abs(np.fft.rfft(mono * np.hanning(len(mono)))) if len(mono) > 8 else np.zeros(1)
    freqs = np.fft.rfftfreq(len(mono), 1 / rate) if len(mono) > 8 else np.zeros(1)
    centroid = float(np.sum(freqs * spectrum) / max(np.sum(spectrum), 1e-12))
    return {
        "durationSeconds": round(len(samples) / rate, 3),
        "activeSeconds": round((end - start) / rate, 3),
        "peakDbfs": round(db(float(np.abs(samples).max())), 2),
        "rmsDbfs": round(db(float(np.sqrt(np.mean(np.square(active))))), 2),
        "loudnessLufsUngated": round(-0.691 + 10 * np.log10(max(power, 1e-24)), 2),
        "clippedPercent": round(100 * float(np.mean(np.abs(samples) >= 0.999)), 4),
        "spectralCentroidHz": round(centroid),
    }


def high_shelf(rate: int, f0: float, gain_db: float, q: float = 0.7071) -> tuple[np.ndarray, np.ndarray]:
    a = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / rate
    alpha = np.sin(w0) / (2 * q)
    cos = np.cos(w0)
    b = [a * ((a + 1) + (a - 1) * cos + 2 * np.sqrt(a) * alpha),
         -2 * a * ((a - 1) + (a + 1) * cos),
         a * ((a + 1) + (a - 1) * cos - 2 * np.sqrt(a) * alpha)]
    den = [(a + 1) - (a - 1) * cos + 2 * np.sqrt(a) * alpha,
           2 * ((a - 1) - (a + 1) * cos),
           (a + 1) - (a - 1) * cos - 2 * np.sqrt(a) * alpha]
    return np.array(b) / den[0], np.array(den) / den[0]


# Interface takes came back brighter than the V165 clicks (spectral centroids
# up to 9-10 kHz against 1-6 kHz); earlier takes judged harsh were bright too.
# A gentle high shelf warms them; world foley keeps its natural spectrum.
WARM_SHELF = {"frequencyHz": 5000.0, "gainDb": -4.0}


def process(raw: Path, out: Path, warm: bool) -> tuple[dict, dict, str]:
    samples, rate = sf.read(raw, dtype="float64", always_2d=True)
    if samples.shape[1] == 1:
        samples = np.repeat(samples, 2, axis=1)
    source = measure(samples, rate)
    if warm:
        b, a = high_shelf(rate, WARM_SHELF["frequencyHz"], WARM_SHELF["gainDb"])
        samples = lfilter(b, a, samples, axis=0)
    start, end = active_span(samples)
    start = max(0, start - round(PRE_ROLL_S * rate))
    end = min(len(samples), end + round(POST_ROLL_S * rate))
    trimmed = samples[start:end].copy()
    peak = float(np.abs(trimmed).max())
    scale = min(1.0, 10 ** (RAW_PEAK_CEILING_DBFS / 20) / peak) if peak > 0 else 1.0
    trimmed *= scale
    fade_in = min(len(trimmed), round(FADE_IN_S * rate))
    fade_out = min(len(trimmed), round(FADE_OUT_S * rate))
    trimmed[:fade_in] *= np.linspace(0, 1, fade_in, endpoint=False)[:, None]
    trimmed[len(trimmed) - fade_out:] *= (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, fade_out)))[:, None]
    with tempfile.TemporaryDirectory(dir=REPO / "tmp") as folder:
        wav = Path(folder) / "take.wav"
        sf.write(wav, trimmed.astype(np.float32), rate, subtype="FLOAT")
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav),
                        "-c:a", "libmp3lame", "-b:a", "128k", "-ar", "44100", "-ac", "2",
                        "-id3v2_version", "0", "-write_id3v1", "0", str(out)], check=True)
    encoded, encoded_rate = sf.read(out, dtype="float64", always_2d=True)
    processing = {
        "tool": "FFmpeg",
        "version": "7.1 imageio-ffmpeg",
        "filter": ((f"high shelf {WARM_SHELF['gainDb']:g} dB above {WARM_SHELF['frequencyHz']:g} Hz (Q 0.707); " if warm else "") +
                   f"trim to samples above {SILENCE_DBFS:g} dBFS with {PRE_ROLL_S * 1000:g} ms pre-roll and "
                   f"{POST_ROLL_S * 1000:g} ms tail; volume={scale:.6f}; linear fade-in {FADE_IN_S * 1000:g} ms; "
                   f"cosine fade-out {FADE_OUT_S * 1000:g} ms (NumPy, before encode)"),
        "encoder": "libmp3lame", "bitrateKbps": 128, "sampleRateHz": 44100, "channels": 2, "id3v2Version": 0,
    }
    return source, {**measure(encoded, encoded_rate), "trimStartSeconds": round(start / rate, 3)}, json.dumps(processing)


def write_json(path: Path, data: object) -> None:
    with open(path, "w", encoding="utf8", newline="\n") as file:
        file.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def append_events(path: Path, events: dict) -> None:
    """Appends the new events at the end of the hand-formatted manifest without
    reformatting the existing entries. Refuses a manifest that already lists one."""
    text = path.read_text(encoding="utf8")
    clash = [key for key in events if key in json.loads(text)["events"]]
    if clash:
        raise SystemExit(f"{path.name} already lists {clash[0]}: restore it before calibrating this lot again")
    body = text.rstrip()
    root = body.rfind("}")
    head = body[:body.rfind("}", 0, root)].rstrip()
    block = ",\n".join(f"    {json.dumps(key)}: " + json.dumps(value, indent=2, ensure_ascii=False).replace("\n", "\n    ")
                       for key, value in events.items())
    updated = head + ",\n" + block + "\n  }\n}\n"
    json.loads(updated)
    with open(path, "w", encoding="utf8", newline="\n") as file:
        file.write(updated)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--balance")
    parser.add_argument("--reject", default="")
    parser.add_argument("--reject-reason", default="discarded after measurement")
    args = parser.parse_args()
    rejected = {name for name in args.reject.split(",") if name}
    plan = json.loads((REPO / "scripts/audio/sfx-plan.json").read_text(encoding="utf8"))
    log = json.loads((REPO / "scripts/audio/generation-log.json").read_text(encoding="utf8"))
    marker = f"-{args.tag}-"
    takes = [entry for entry in log["generations"] if marker in entry["filename"]]
    rows, derivations, events = [], [], {}
    rejected_rows = []
    for entry in takes:
        cue, raw = entry["id"], SFX / entry["filename"]
        if raw.name in rejected:
            # Discarded after measurement: the raw take is not kept in the
            # repository; its prompt, parameters and hash stay in the log.
            rejected_rows.append({"id": cue, "sourceFile": raw.name, "sourceSha256": entry["sha256"], "reason": args.reject_reason})
            continue
        item = plan["events"][cue]
        spatial = item.get("spatial", True) is not False
        family = family_of(cue, spatial)
        target = FAMILIES[family]
        out = SFX / entry["filename"].replace(".mp3", "-cal.mp3")
        source, output, processing = process(raw, out, warm=family != "world")
        gain = min(10 ** ((target["targetRmsDbfs"] - output["rmsDbfs"]) / 20),
                   10 ** ((target["peakCeilingDbfs"] - output["peakDbfs"]) / 20))
        gain = float(min(8.0, max(0.05, round(gain, 3))))
        row = {
            "id": cue, "family": family, **target, "file": out.name, "sourceFile": raw.name,
            "sha256": sha256(out), "bytes": out.stat().st_size,
            "decodedBytesFloat32": int(round(output["durationSeconds"] * 44100)) * 2 * 4,
            "source": source, **{key: value for key, value in output.items()},
            "variantGain": gain,
            "effectiveRmsDbfs": round(output["rmsDbfs"] + db(gain), 2),
            "effectivePeakDbfs": round(output["peakDbfs"] + db(gain), 2),
            "effectiveLufsUngated": round(output["loudnessLufsUngated"] + db(gain), 2),
            "published": out.name not in rejected and raw.name not in rejected,
        }
        rows.append(row)
        print(f"{cue:26s} {out.name:44s} dur={output['durationSeconds']:.2f} peak={output['peakDbfs']:6.1f} "
              f"rms={output['rmsDbfs']:6.1f} lufs={output['loudnessLufsUngated']:6.1f} cen={output['spectralCentroidHz']:5d} "
              f"gain={gain:.3f} eff={row['effectiveRmsDbfs']:6.1f}/{row['effectivePeakDbfs']:5.1f}"
              f"{'' if row['published'] else '  REJECTED'}")
        if not row["published"]:
            continue
        derivations.append({
            "id": cue, "sourceFilename": raw.name, "sourceSha256": entry["sha256"], "filename": out.name,
            "sha256": row["sha256"], "processing": json.loads(processing),
            "decodedMeasurements": {"source": source, "output": output}, "listeningValidation": "pending",
        })
        event = events.setdefault(cue, {"variants": [], "gain": 1, **({"maxDistance": item["maxDistance"]} if spatial else {}),
                                         "loop": False, **({} if spatial else {"spatial": False})})
        event["variants"].append({"src": f"/assets/audio/sfx/{out.name}", "gain": gain})
    if not args.write:
        return
    append_events(REPO / "public/assets/audio/manifest.json", events)
    processing_path = REPO / "scripts/audio/processing-log.json"
    processing_log = json.loads(processing_path.read_text(encoding="utf8"))
    kept = [item for item in processing_log["derivations"] if marker not in item["filename"]]
    processing_log["derivations"] = kept + derivations
    write_json(processing_path, processing_log)
    if args.balance:
        balance = {
            "version": 1,
            "method": ("SoundFile + NumPy + SciPy on all decoded samples of the encoded MP3. Takes trimmed to the span above "
                       f"{SILENCE_DBFS:g} dBFS ({PRE_ROLL_S * 1000:g} ms pre-roll, {POST_ROLL_S * 1000:g} ms tail), faded, "
                       f"attenuated only when the raw peak exceeded {RAW_PEAK_CEILING_DBFS:g} dBFS, encoded once with FFmpeg 7.1 "
                       "libmp3lame 128 kb/s 44.1 kHz stereo; interface takes first get a -4 dB high shelf above 5 kHz. "
                       "RMS over the active span; loudness = BS.1770 K-weighted, ungated. "
                       "Variant gain = min(gain to the family target RMS, gain to the family peak ceiling); event gain 1. "
                       "Arithmetic balance only: no human listening, no mixed-output or distance proof."),
            "families": FAMILIES,
            "interfaceWarmShelf": WARM_SHELF,
            "files": rows,
            "rejectedTakes": rejected_rows,
        }
        write_json(REPO / args.balance, balance)


if __name__ == "__main__":
    main()
