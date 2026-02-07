import logging
import httpx
from timezonefinder import TimezoneFinder

logger = logging.getLogger(__name__)

_tf = TimezoneFinder()


def lookup_timezone(lat: float, lon: float) -> str:
    """Return IANA timezone string for given coordinates."""
    tz = _tf.timezone_at(lat=lat, lng=lon)
    if tz is None:
        offset = round(lon / 15)
        tz = f"Etc/GMT{-offset:+d}" if offset != 0 else "UTC"
    return tz


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
