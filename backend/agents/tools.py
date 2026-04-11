"""External tool functions for virtual lab agents — AlphaFold, UniProt."""
from __future__ import annotations

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_UNIPROT_SEARCH = "https://rest.uniprot.org/uniprotkb/search"
_ALPHAFOLD_API = "https://alphafold.ebi.ac.uk/api/prediction"


async def lookup_alphafold(protein_name: str) -> Optional[dict]:
    """
    Resolve a protein/gene name to a UniProt accession then fetch the
    corresponding AlphaFold structure prediction from EBI.

    Returns a structured dict or None if no entry exists.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # ── Step 1: UniProt search (reviewed human proteins) ──────────────
            for query in [
                f"(gene_exact:{protein_name}) AND (taxonomy_id:9606) AND (reviewed:true)",
                f"(gene:{protein_name}) AND (taxonomy_id:9606) AND (reviewed:true)",
                f"(protein_name:{protein_name}) AND (taxonomy_id:9606) AND (reviewed:true)",
            ]:
                resp = await client.get(
                    _UNIPROT_SEARCH,
                    params={
                        "query": query,
                        "format": "json",
                        "size": "1",
                        "fields": "accession,gene_names,protein_name",
                    },
                )
                if resp.status_code == 200:
                    results = resp.json().get("results", [])
                    if results:
                        break
            else:
                return None

            entry = results[0]
            accession: str = entry.get("primaryAccession", "")
            if not accession:
                return None

            # Parse human-readable names
            prot_desc = (
                entry.get("proteinDescription", {})
                     .get("recommendedName", {})
                     .get("fullName", {})
                     .get("value", protein_name)
            )
            gene_list = entry.get("genes", [])
            gene_name = protein_name
            if gene_list:
                gene_data = gene_list[0].get("geneName", {})
                if isinstance(gene_data, dict):
                    gene_name = gene_data.get("value", protein_name)

            # ── Step 2: AlphaFold prediction ──────────────────────────────────
            af_resp = await client.get(f"{_ALPHAFOLD_API}/{accession}")
            if af_resp.status_code != 200:
                return None

            af_data = af_resp.json()
            if not af_data:
                return None

            af = af_data[0]
            confidence = round(float(af.get("confidenceAvgLocalScore", 0)), 1)

            return {
                "protein_name": protein_name,
                "uniprot_name": prot_desc,
                "accession": accession,
                "gene": gene_name,
                "mean_confidence": confidence,
                "confidence_tier": (
                    "high" if confidence >= 70 else
                    "medium" if confidence >= 50 else "low"
                ),
                "pdb_url": af.get("pdbUrl", ""),
                "entry_id": af.get("entryId", f"AF-{accession}-F1"),
                "alphafold_url": f"https://alphafold.ebi.ac.uk/entry/{accession}",
            }

    except Exception as exc:
        logger.warning("AlphaFold lookup failed for '%s': %s", protein_name, exc)
        return None
