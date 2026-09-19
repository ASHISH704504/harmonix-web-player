# HARMONIX // CYBER_DECK_WEB

Browser-based version of the Harmonix desktop music player. Serves the demo synth tracks and a dark retro/cyberpunk single-page player with play/pause, next/prev, shuffle/repeat, seek, volume, favourites, search and a live spectrum visualizer.

## Run locally

```
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000

## Deploy on Render

Connect this repo to Render as a Python web service (see `render.yaml`). No env vars required.

- `.gunicorn` start command: `gunicorn app:app`
- Health check: `/`