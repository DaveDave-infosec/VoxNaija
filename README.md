# VoxNaija

Free text-to-speech web app with Nigerian, American & British voices.

## Local development

    pip install -r requirements.txt
    python -m uvicorn app:app --reload

Open http://localhost:8000 in your browser.

## Deployment

Designed for Vercel. Push to a GitHub repo & import on Vercel — no build configuration needed. Vercel auto-detects the FastAPI app at `app.py` & serves static assets from `public/` via its CDN.

## Voices

- Nigerian: Ezinne (F), Abeo (M)
- American: Jenny (F), Guy (M)
- British: Sonia (F), Ryan (M)

Powered by [edge-tts](https://github.com/rany2/edge-tts).
