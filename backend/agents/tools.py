"""External tool functions for virtual lab agents — AlphaFold, UniProt."""
from __future__ import annotations

import json
import logging
import os
import re
from collections import OrderedDict
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

_UNIPROT_SEARCH = "https://rest.uniprot.org/uniprotkb/search"
_ALPHAFOLD_API = "https://alphafold.ebi.ac.uk/api/prediction"

_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
_openai_client: Any = None
if _OPENAI_API_KEY:
    try:
        from openai import AsyncOpenAI
        _openai_client = AsyncOpenAI(api_key=_OPENAI_API_KEY)
    except ImportError:
        pass


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


# ---------------------------------------------------------------------------
# Per-residue pLDDT from AlphaFold PDB
# ---------------------------------------------------------------------------


async def fetch_per_residue_plddt(pdb_url: str) -> List[Dict[str, Any]]:
    """
    Download an AlphaFold PDB file and parse per-residue pLDDT scores
    from the B-factor column.  Returns one entry per residue (CA atoms).
    """
    if not pdb_url:
        return []
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(pdb_url)
            if resp.status_code != 200:
                logger.warning("PDB download failed (%s): %s", resp.status_code, pdb_url)
                return []

        residues: OrderedDict[int, Dict[str, Any]] = OrderedDict()
        for line in resp.text.splitlines():
            if not line.startswith("ATOM"):
                continue
            atom_name = line[12:16].strip()
            if atom_name != "CA":
                continue
            res_name = line[17:20].strip()
            try:
                res_seq = int(line[22:26].strip())
                bfactor = float(line[60:66].strip())
            except (ValueError, IndexError):
                continue
            if res_seq not in residues:
                residues[res_seq] = {
                    "residue_index": res_seq,
                    "residue_name": res_name,
                    "plddt_score": round(bfactor, 1),
                }

        return list(residues.values())

    except Exception as exc:
        logger.warning("Per-residue pLDDT parsing failed: %s", exc)
        return []


# ---------------------------------------------------------------------------
# LLM-powered binding interface prediction
# ---------------------------------------------------------------------------

_BINDING_INTERFACE_PROMPT = """You are a structural biology expert. Given two proteins that are known or hypothesized to interact, predict the key binding interface residues.

Protein A: {protein_a} ({gene_a})
Protein B: {protein_b} ({gene_b})

Return a JSON object with this exact schema:
{{
  "interface_residues_a": [
    {{"residue_index": <int>, "residue_name": "<3-letter code>", "interaction_type": "hydrogen_bond|salt_bridge|hydrophobic|van_der_waals", "partner_residue": "<residue on other protein>"}}
  ],
  "interface_residues_b": [
    {{"residue_index": <int>, "residue_name": "<3-letter code>", "interaction_type": "hydrogen_bond|salt_bridge|hydrophobic|van_der_waals", "partner_residue": "<residue on other protein>"}}
  ],
  "hydrogen_bonds": [
    {{"donor": "<protein>-<residue>-<index>", "acceptor": "<protein>-<residue>-<index>", "estimated_distance_angstrom": <float>}}
  ],
  "interface_area_sq_angstrom": <float>,
  "binding_type": "protein-protein|enzyme-substrate|receptor-ligand",
  "confidence": <float 0-1>,
  "description": "<1-2 sentence description of the binding interface>"
}}

Base your prediction on known structural biology. Include 5-8 interface residues per protein and 3-5 hydrogen bonds. Use real residue names and plausible indices."""


async def generate_binding_interface(
    protein_a: str,
    protein_b: str,
    gene_a: str = "",
    gene_b: str = "",
) -> Optional[Dict[str, Any]]:
    """
    Use OpenAI to predict the binding interface between two proteins.
    Returns structured interface data or None on failure.
    """
    if not _openai_client:
        logger.warning("No OpenAI client for binding interface prediction")
        return None

    prompt = _BINDING_INTERFACE_PROMPT.format(
        protein_a=protein_a,
        protein_b=protein_b,
        gene_a=gene_a or protein_a,
        gene_b=gene_b or protein_b,
    )

    try:
        response = await _openai_client.chat.completions.create(
            model=os.getenv("OPENAI_AGENT_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": "You are a structural biology expert. Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=2048,
        )
        text = (response.choices[0].message.content or "").strip()

        # Strip markdown fences
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)

        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            data = json.loads(match.group())
            data["protein_a"] = protein_a
            data["protein_b"] = protein_b
            return data

    except Exception as exc:
        logger.warning("Binding interface prediction failed: %s", exc)

    return None
