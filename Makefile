.PHONY: dev backend frontend

dev:
	python3 scripts/dev.py

backend:
	python3 backend/run.py

frontend:
	cd frontend && npm run dev
