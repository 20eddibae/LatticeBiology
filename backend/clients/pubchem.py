"""PubChem REST PUG client for compound properties and SMILES."""
from __future__ import annotations

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_PUBCHEM_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"


async def get_smiles_from_pubchem(compound_name: str) -> Optional[str]:
    """Resolve a compound name to its canonical SMILES string."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{_PUBCHEM_BASE}/compound/name/{compound_name}/property/CanonicalSMILES/JSON",
        )
        if resp.status_code != 200:
            return None
        props = resp.json().get("PropertyTable", {}).get("Properties", [])
        if props:
            # PubChem may return CanonicalSMILES or ConnectivitySMILES
            return props[0].get("CanonicalSMILES") or props[0].get("ConnectivitySMILES")
        return None


async def get_compound_properties(compound_name: str) -> Optional[dict]:
    """Fetch molecular properties for a compound by name."""
    fields = "MolecularFormula,MolecularWeight,XLogP,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,CanonicalSMILES"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{_PUBCHEM_BASE}/compound/name/{compound_name}/property/{fields}/JSON",
        )
        if resp.status_code != 200:
            return None

        props = resp.json().get("PropertyTable", {}).get("Properties", [])
        if not props:
            return None

        p = props[0]
        return {
            "cid": p.get("CID"),
            "name": compound_name,
            "smiles": p.get("CanonicalSMILES") or p.get("ConnectivitySMILES", ""),
            "molecular_formula": p.get("MolecularFormula", ""),
            "molecular_weight": p.get("MolecularWeight"),
            "xlogp": p.get("XLogP"),
            "hbd": p.get("HBondDonorCount"),
            "hba": p.get("HBondAcceptorCount"),
            "rotatable_bonds": p.get("RotatableBondCount"),
        }
