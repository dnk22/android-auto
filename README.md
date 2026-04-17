# Android Automation Monorepo

## Requirements
- Python 3.11
- Node.js 18+
- Android SDK + adb on PATH

## Install

Backend:
```
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Frontend:
```
cd frontend
npm install
```

Media server:
```
cd media-server
npm install
```
If you want live streaming, install one scrcpy adapter package in `media-server` as well, such as `@yume-chan/scrcpy`, `ws-scrcpy`, or `node-scrcpy`.

## Run

Full system:
```
python3 scripts/dev.py
```

Or via Makefile:
```
make dev
```

Backend only:
```
make backend
```

Frontend only:
```
make frontend
```
