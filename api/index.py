"""Vercel serverless entry point — wraps the FastAPI backend."""
import sys
import os

# Add backend/ to Python path so its internal imports (routers, services) resolve
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from main import app  # noqa: E402, F401 — Vercel detects the `app` ASGI object
