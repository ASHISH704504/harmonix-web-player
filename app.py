import os
import json

from flask import Flask, render_template, jsonify

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(BASE_DIR, "static", "audio")
API_BASE = "/static/audio"

app = Flask(__name__)

DEFAULT_META = [
    {
        "artist": "AETHER GEAR",
        "album": "CYBER_DECK_V2",
        "genre": "SYNTHWAVE",
        "bpm": 124,
    },
    {
        "artist": "MIDNIGHT RADIO",
        "album": "LATE NITE SESSIONS",
        "genre": "CHILLSYNTH",
        "bpm": 100,
    },
    {
        "artist": "NEON DRIFT",
        "album": "HORIZON LOGS",
        "genre": "WAVE",
        "bpm": 138,
    },
]


def _human_duration_seconds(file_name):
    try:
        import wave
        with wave.open(os.path.join(AUDIO_DIR, file_name), "rb") as w:
            frames = w.getnframes()
            rate = w.getframerate()
            return round(frames / float(rate), 1)
    except Exception:
        return 0.0


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/tracks")
def api_tracks():
    tracks = []
    files = sorted(f for f in os.listdir(AUDIO_DIR) if f.lower().endswith((".wav", ".mp3", ".ogg", ".flac", ".m4a")))
    for i, name in enumerate(files):
        meta = DEFAULT_META[i % len(DEFAULT_META)]
        title = os.path.splitext(name)[0].replace("_", " ")
        tracks.append({
            "title": title,
            "artist": meta["artist"],
            "album": meta["album"],
            "genre": meta["genre"],
            "bpm": meta["bpm"],
            "url": f"{API_BASE}/{name}",
            "duration": _human_duration_seconds(name),
        })
    return jsonify(tracks)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)