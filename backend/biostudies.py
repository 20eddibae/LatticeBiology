from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://www.ebi.ac.uk/biostudies/api/v1"
TIMEOUT = 30.0
MAX_RETRIES = 3


async def _get_with_retry(
    client: httpx.AsyncClient, url: str, params: Optional[Dict[str, Any]] = None
) -> httpx.Response:
    last_exc: Exception = RuntimeError("No attempts made")
    for attempt in range(MAX_RETRIES):
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response
        except (httpx.RequestError, httpx.HTTPStatusError) as exc:
            last_exc = exc
            wait = 2 ** attempt
            logger.warning(
                "BioStudies request failed (attempt %d/%d): %s — retrying in %ds",
                attempt + 1,
                MAX_RETRIES,
                exc,
                wait,
            )
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(wait)
    raise last_exc


def _attr(attributes: list, name: str) -> Optional[str]:
    """Extract a named attribute value from a BioStudies attributes list."""
    for attr in attributes:
        if isinstance(attr, dict) and attr.get("name") == name:
            return attr.get("value")
    return None


async def search_studies(query: str = "cancer", page_size: int = 10) -> List[Dict[str, Any]]:
    """Search the BioStudies API. Returns a list of raw study dicts."""
    url = f"{BASE_URL}/search"
    params = {"query": query, "pageSize": page_size}

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await _get_with_retry(client, url, params=params)
            data = response.json()

        hits: List[Any] = data.get("hits", []) or []
        results: List[Dict[str, Any]] = []
        for hit in hits:
            accession = hit.get("accession", "")
            title = hit.get("title", "Untitled")
            content = hit.get("content", "") or ""

            # The content field is: "accession PMCID title abstract..."
            # Strip the accession/PMC prefix to get a usable abstract
            abstract = content
            for prefix in [accession, title]:
                if prefix and abstract.startswith(prefix):
                    abstract = abstract[len(prefix):].strip()
            # Also strip PMC IDs (e.g. "PMC10139049")
            parts = abstract.split(" ", 1)
            if parts and parts[0].startswith("PMC"):
                abstract = parts[1] if len(parts) > 1 else ""
            # If abstract still starts with the title, strip that too
            if abstract.startswith(title):
                abstract = abstract[len(title):].strip()

            author_str = hit.get("author", "") or ""
            author_list = []
            if author_str:
                for name in author_str.split(" "):
                    # Authors are space-separated "LastF" tokens;
                    # group pairs (e.g. "Korbecki J") by looking for single initials
                    pass
                # Simpler: split on known pattern "Name Initial"
                import re
                author_names = re.findall(r"[A-Z][a-z]+ [A-Z]+", author_str)
                if not author_names:
                    author_names = [author_str]
                author_list = [{"name": n.strip()} for n in author_names if n.strip()]

            results.append({
                "accession": accession,
                "title": title,
                "release_date": hit.get("release_date", ""),
                "content": content,
                "abstract": abstract if abstract != title else None,
                "author": author_list,
                "links": [],
            })

        logger.info(
            "BioStudies search '%s' returned %d results",
            query,
            len(results),
        )
        return results

    except Exception as exc:
        logger.error("BioStudies search unavailable (%s)", exc)
        return []


async def fetch_study(accession: str) -> Dict[str, Any]:
    """Fetch a single study by accession. Parses the nested BioStudies structure."""
    url = f"{BASE_URL}/studies/{accession}"

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await _get_with_retry(client, url)
            data = response.json()

        section = data.get("section", {}) or {}
        sec_attrs = section.get("attributes", []) or []
        top_attrs = data.get("attributes", []) or []

        title = _attr(sec_attrs, "Title") or _attr(top_attrs, "Title") or "Untitled"
        abstract = _attr(sec_attrs, "Abstract")
        release_date = _attr(top_attrs, "ReleaseDate") or _attr(sec_attrs, "ReleaseDate") or ""

        # Parse authors from subsections
        authors: List[Dict[str, Any]] = []
        orgs: Dict[str, str] = {}

        for sub in section.get("subsections", []):
            items = sub if isinstance(sub, list) else [sub]
            for item in items:
                if not isinstance(item, dict):
                    continue
                sub_type = item.get("type", "")
                sub_attrs = item.get("attributes", [])

                if sub_type == "Organization":
                    org_name = _attr(sub_attrs, "Name")
                    org_id = item.get("accno", "")
                    if org_name and org_id:
                        orgs[org_id] = org_name

                if sub_type == "Author":
                    name = _attr(sub_attrs, "Name") or "Unknown"
                    affil_ref = None
                    for a in sub_attrs:
                        if isinstance(a, dict) and a.get("name") == "affiliation":
                            affil_ref = a.get("value")
                    authors.append({
                        "name": name,
                        "affiliation": orgs.get(affil_ref, "") if affil_ref else None,
                    })

        # Parse links
        links: List[Dict[str, Any]] = []
        for link_group in section.get("links", []):
            items = link_group if isinstance(link_group, list) else [link_group]
            for lnk in items:
                if not isinstance(lnk, dict):
                    continue
                link_url = lnk.get("url", "")
                link_attrs = lnk.get("attributes", [])
                link_type = _attr(link_attrs, "Type") or "url"
                if link_url:
                    links.append({
                        "url": link_url,
                        "type": link_type,
                        "description": _attr(link_attrs, "Description"),
                    })

        result = {
            "accession": data.get("accno", accession),
            "title": title,
            "release_date": release_date,
            "abstract": abstract,
            "author": authors,
            "links": links,
        }

        logger.info("Fetched study %s from BioStudies API (%d authors, %d links)",
                     accession, len(authors), len(links))
        return result

    except Exception as exc:
        logger.warning("Could not fetch study %s (%s)", accession, exc)
        return {
            "accession": accession,
            "title": f"Study {accession}",
            "release_date": "",
            "author": [],
            "links": [],
            "abstract": None,
        }
