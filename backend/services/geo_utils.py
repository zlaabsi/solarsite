import logging
import httpx

logger = logging.getLogger(__name__)


def lookup_timezone(lat: float, lon: float) -> str:
    """Return Etc/GMT±N timezone string from longitude.

    Uses longitude-based UTC offset (accurate for solar calculations).
    Replaces the 51 MB timezonefinder package to fit Vercel's 250 MB limit.
    """
    offset = round(lon / 15)
    return f"Etc/GMT{-offset:+d}" if offset != 0 else "UTC"


def classify_terrain(elevation_m: float) -> str:
    """Classify terrain type from elevation."""
    if elevation_m < 100:
        return "flat_lowland"
    elif elevation_m < 500:
        return "flat_plateau"
    elif elevation_m < 1500:
        return "elevated_terrain"
    else:
        return "highland"


def reverse_geocode(lat: float, lon: float) -> str:
    """Return 'CITY, COUNTRY' from coordinates via Nominatim.

    Falls back to coordinate-based label on any failure.
    """
    try:
        resp = httpx.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={
                "lat": lat,
                "lon": lon,
                "format": "json",
                "zoom": 10,
                "accept-language": "en",
            },
            headers={"User-Agent": "SolarSite/1.0"},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        addr = data.get("address", {})
        city = (
            addr.get("city")
            or addr.get("town")
            or addr.get("village")
            or addr.get("county")
            or addr.get("state")
            or ""
        )
        country = addr.get("country", "")
        if city and country:
            return f"{city}, {country}".upper()
        if country:
            return country.upper()
    except Exception as e:
        logger.debug(f"reverse_geocode failed: {e}")
    # Fallback
    lat_dir = "N" if lat >= 0 else "S"
    lon_dir = "E" if lon >= 0 else "W"
    return f"{abs(lat):.2f}\u00b0{lat_dir} {abs(lon):.2f}\u00b0{lon_dir}"
