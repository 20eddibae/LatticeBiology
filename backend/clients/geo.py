"""NCBI GEO DataSets client using E-utilities."""
from __future__ import annotations

import asyncio
import logging
import xml.etree.ElementTree as ET
from typing import List

import httpx

logger = logging.getLogger(__name__)

_EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
_RATE_DELAY = 0.35


async def search_geo_datasets(query: str, max_results: int = 10) -> List[dict]:
    """Search GEO DataSets and return dataset metadata."""
    async with httpx.AsyncClient(timeout=20.0) as client:
        # Step 1: esearch on gds database
        resp = await client.get(
            f"{_EUTILS_BASE}/esearch.fcgi",
            params={
                "db": "gds",
                "term": query,
                "retmax": str(min(max_results, 50)),
                "retmode": "json",
            },
        )
        resp.raise_for_status()
        id_list = resp.json().get("esearchresult", {}).get("idlist", [])

        if not id_list:
            return []

        await asyncio.sleep(_RATE_DELAY)

        # Step 2: esummary for metadata
        resp = await client.get(
            f"{_EUTILS_BASE}/esummary.fcgi",
            params={
                "db": "gds",
                "id": ",".join(id_list),
                "retmode": "json",
            },
        )
        resp.raise_for_status()
        data = resp.json().get("result", {})

        results = []
        for uid in id_list:
            entry = data.get(uid)
            if not entry or isinstance(entry, str):
                continue
            results.append({
                "gds_id": uid,
                "accession": entry.get("accession", ""),
                "title": entry.get("title", ""),
                "summary": entry.get("summary", ""),
                "organism": entry.get("taxon", ""),
                "sample_count": entry.get("n_samples", 0),
                "platform": entry.get("gpl", ""),
                "pdat": entry.get("pdat", ""),
            })

        return results
