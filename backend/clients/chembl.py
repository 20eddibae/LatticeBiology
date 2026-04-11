"""ChEMBL REST API client for compound and bioactivity data."""
from __future__ import annotations

import logging
from typing import List, Optional

import httpx

logger = logging.getLogger(__name__)

_CHEMBL_BASE = "https://www.ebi.ac.uk/chembl/api/data"


async def search_chembl_compounds(query: str, max_results: int = 10) -> List[dict]:
    """Search ChEMBL for compounds matching the query."""
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(
            f"{_CHEMBL_BASE}/molecule/search",
            params={"q": query, "format": "json", "limit": str(min(max_results, 20))},
        )
        resp.raise_for_status()
        data = resp.json()
        molecules = data.get("molecules", [])

        results = []
        for mol in molecules:
            props = mol.get("molecule_properties") or {}
            structs = mol.get("molecule_structures") or {}
            results.append({
                "chembl_id": mol.get("molecule_chembl_id", ""),
                "pref_name": mol.get("pref_name") or "",
                "max_phase": mol.get("max_phase") or 0,
                "molecular_formula": props.get("full_molformula", ""),
                "smiles": structs.get("canonical_smiles", ""),
                "alogp": _safe_float(props.get("alogp")),
                "mw_freebase": _safe_float(props.get("full_mwt")),
            })
        return results


async def get_chembl_compound(chembl_id: str) -> Optional[dict]:
    """Fetch a single ChEMBL compound by ID."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{_CHEMBL_BASE}/molecule/{chembl_id}",
            params={"format": "json"},
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        mol = resp.json()
        props = mol.get("molecule_properties") or {}
        structs = mol.get("molecule_structures") or {}
        return {
            "chembl_id": mol.get("molecule_chembl_id", ""),
            "pref_name": mol.get("pref_name") or "",
            "max_phase": mol.get("max_phase") or 0,
            "molecular_formula": props.get("full_molformula", ""),
            "smiles": structs.get("canonical_smiles", ""),
            "alogp": _safe_float(props.get("alogp")),
            "mw_freebase": _safe_float(props.get("full_mwt")),
        }


async def get_chembl_bioactivities(
    chembl_id: str, max_results: int = 20
) -> List[dict]:
    """Fetch bioactivity data for a ChEMBL compound."""
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(
            f"{_CHEMBL_BASE}/activity",
            params={
                "molecule_chembl_id": chembl_id,
                "format": "json",
                "limit": str(min(max_results, 50)),
            },
        )
        resp.raise_for_status()
        data = resp.json()
        activities = data.get("activities", [])

        results = []
        for act in activities:
            results.append({
                "target_chembl_id": act.get("target_chembl_id", ""),
                "target_pref_name": act.get("target_pref_name", ""),
                "assay_type": act.get("assay_type", ""),
                "standard_type": act.get("standard_type", ""),
                "standard_value": _safe_float(act.get("standard_value")),
                "standard_units": act.get("standard_units", ""),
                "pchembl_value": _safe_float(act.get("pchembl_value")),
            })
        return results


def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None
