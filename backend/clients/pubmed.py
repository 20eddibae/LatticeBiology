"""PubMed client using NCBI E-utilities (esearch + efetch)."""
from __future__ import annotations

import asyncio
import logging
import xml.etree.ElementTree as ET
from typing import List

import httpx

logger = logging.getLogger(__name__)

_EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
_RATE_DELAY = 0.35  # NCBI allows 3 req/s without API key


async def search_pubmed(query: str, max_results: int = 10) -> List[dict]:
    """Search PubMed and return article metadata with abstracts."""
    async with httpx.AsyncClient(timeout=20.0) as client:
        # Step 1: esearch to get PMIDs
        resp = await client.get(
            f"{_EUTILS_BASE}/esearch.fcgi",
            params={
                "db": "pubmed",
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

        # Step 2: efetch to get full records
        resp = await client.get(
            f"{_EUTILS_BASE}/efetch.fcgi",
            params={
                "db": "pubmed",
                "id": ",".join(id_list),
                "retmode": "xml",
            },
        )
        resp.raise_for_status()

        return _parse_pubmed_xml(resp.text)


async def fetch_pubmed_article(pmid: str) -> dict | None:
    """Fetch a single PubMed article by PMID."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{_EUTILS_BASE}/efetch.fcgi",
            params={"db": "pubmed", "id": pmid, "retmode": "xml"},
        )
        resp.raise_for_status()
        articles = _parse_pubmed_xml(resp.text)
        return articles[0] if articles else None


def _parse_pubmed_xml(xml_text: str) -> List[dict]:
    """Parse PubMed efetch XML into structured dicts."""
    articles = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        logger.warning("Failed to parse PubMed XML response")
        return []

    for article_el in root.findall(".//PubmedArticle"):
        medline = article_el.find("MedlineCitation")
        if medline is None:
            continue

        pmid_el = medline.find("PMID")
        art = medline.find("Article")
        if art is None:
            continue

        # Title
        title_el = art.find("ArticleTitle")
        title = title_el.text if title_el is not None and title_el.text else ""

        # Abstract
        abstract_parts = []
        abstract_el = art.find("Abstract")
        if abstract_el is not None:
            for at in abstract_el.findall("AbstractText"):
                label = at.get("Label", "")
                text = "".join(at.itertext()).strip()
                if label:
                    abstract_parts.append(f"{label}: {text}")
                else:
                    abstract_parts.append(text)
        abstract = " ".join(abstract_parts)

        # Authors
        authors = []
        author_list = art.find("AuthorList")
        if author_list is not None:
            for auth in author_list.findall("Author"):
                last = auth.findtext("LastName", "")
                init = auth.findtext("Initials", "")
                if last:
                    authors.append(f"{last} {init}".strip())

        # Journal
        journal_el = art.find("Journal/Title")
        journal = journal_el.text if journal_el is not None else ""

        # Date
        pub_date_el = art.find("Journal/JournalIssue/PubDate")
        pub_date = ""
        if pub_date_el is not None:
            year = pub_date_el.findtext("Year", "")
            month = pub_date_el.findtext("Month", "")
            day = pub_date_el.findtext("Day", "")
            pub_date = f"{year} {month} {day}".strip()

        # MeSH terms
        mesh_terms = []
        mesh_list = medline.find("MeshHeadingList")
        if mesh_list is not None:
            for mh in mesh_list.findall("MeshHeading/DescriptorName"):
                if mh.text:
                    mesh_terms.append(mh.text)

        articles.append({
            "pmid": pmid_el.text if pmid_el is not None else "",
            "title": title,
            "abstract": abstract,
            "authors": authors,
            "journal": journal,
            "pub_date": pub_date,
            "mesh_terms": mesh_terms,
        })

    return articles
