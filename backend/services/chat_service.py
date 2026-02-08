import json
import logging
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

MODEL = "gpt-5-mini"

SYSTEM_PROMPT = (
    "You are SolarSite's AI assistant — an expert in solar energy, photovoltaic systems, "
    "and site assessment. You help users understand their solar analysis results.\n\n"
    "Rules:\n"
    "- Be concise (2-4 sentences unless asked for detail)\n"
    "- Use technical solar terminology accurately\n"
    "- Reference the analysis data when answering questions about results\n"
    "- If the user asks to perform an action, append ACTION: followed by a JSON object "
    "at the very end of your response on its own line. "
    'Valid actions: {"action":"run_analysis"}, {"action":"toggle_heatmap"}, {"action":"show_report"}\n'
    "- If no action is needed, do not include ACTION:\n"
)


def _compact_analysis(data: dict) -> dict:
    """Strip large fields (heatmaps, panels_geojson) to fit context."""
    if not data:
        return {}
    compact = {}
    for key, val in data.items():
        if key in ("heatmap_summer", "heatmap_winter", "panels_geojson"):
            continue
        if isinstance(val, dict):
            compact[key] = {
                k: v
                for k, v in val.items()
                if k not in ("heatmap_summer", "heatmap_winter", "panels_geojson")
            }
        else:
            compact[key] = val
    return compact


def _build_messages(
    message: str, history: list, analysis_data: dict | None
) -> list:
    """Build Chat Completions API messages."""
    system_text = SYSTEM_PROMPT
    if analysis_data:
        compact = _compact_analysis(analysis_data)
        system_text += f"\nCurrent analysis data:\n{json.dumps(compact, default=str)}"

    messages = [{"role": "system", "content": system_text}]

    for entry in history:
        role = entry.get("role", "user")
        content = entry.get("content", "")
        messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": message})

    return messages


def _parse_action(full_text: str) -> tuple[str, dict | None]:
    """Extract ACTION: JSON from the end of the response."""
    lines = full_text.strip().split("\n")
    action = None
    display_lines = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("ACTION:"):
            try:
                action = json.loads(stripped[7:].strip())
            except json.JSONDecodeError:
                display_lines.append(line)
        else:
            display_lines.append(line)

    return "\n".join(display_lines).strip(), action


async def stream_chat_response(
    message: str, history: list, analysis_data: dict | None = None
):
    """Async generator yielding SSE-ready dicts: token, done."""
    client = AsyncOpenAI()
    messages = _build_messages(message, history, analysis_data)

    full_text = ""

    try:
        stream = await client.chat.completions.create(
            model=MODEL,
            messages=messages,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                full_text += delta
                yield {"type": "token", "content": delta}

        display_text, action = _parse_action(full_text)
        yield {"type": "done", "content": display_text, "action": action}

    except Exception as e:
        logger.error(f"Chat stream error: {e}")
        # Fallback: non-streaming
        try:
            response = await client.chat.completions.create(
                model=MODEL,
                messages=messages,
            )
            text = response.choices[0].message.content or ""
            display_text, action = _parse_action(text)
            yield {"type": "token", "content": display_text}
            yield {"type": "done", "content": display_text, "action": action}
        except Exception as e2:
            logger.error(f"Chat fallback error: {e2}")
            yield {
                "type": "done",
                "content": "Sorry, I encountered an error. Please try again.",
                "action": None,
            }
