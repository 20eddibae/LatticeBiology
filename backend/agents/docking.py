"""
Heuristic molecular docking prediction module.

Uses PubChem molecular properties (MW, LogP, HBD, HBA, rotatable bonds)
to estimate drug-target binding compatibility via Lipinski/Veber-derived
scoring. Not a replacement for physics-based docking — a fast first-pass
filter for the virtual lab pipeline.
"""
from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def _to_float(val: Any) -> Optional[float]:
    """Safely convert a value to float (PubChem sometimes returns strings)."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _lipinski_score(props: dict) -> float:
    """Score 0-1 based on Lipinski Rule of Five compliance."""
    violations = 0
    mw = _to_float(props.get("molecular_weight"))
    logp = _to_float(props.get("xlogp"))
    hbd = _to_float(props.get("hbd"))
    hba = _to_float(props.get("hba"))

    if mw is not None and mw > 500:
        violations += 1
    if logp is not None and logp > 5:
        violations += 1
    if hbd is not None and hbd > 5:
        violations += 1
    if hba is not None and hba > 10:
        violations += 1

    return max(0.0, 1.0 - violations * 0.25)


def _veber_score(props: dict) -> float:
    """Score 0-1 based on Veber oral bioavailability rules."""
    score = 1.0
    rot = _to_float(props.get("rotatable_bonds"))
    hba = _to_float(props.get("hba"))
    hbd = _to_float(props.get("hbd"))
    tpsa_proxy = ((hba or 0) * 20 + (hbd or 0) * 25)  # rough TPSA proxy

    if rot is not None and rot > 10:
        score -= 0.3
    if tpsa_proxy > 140:
        score -= 0.3

    return max(0.0, score)


def _mw_complementarity(mw: Any) -> float:
    """Proteins interact better with compounds in optimal MW range (200-500)."""
    mw = _to_float(mw)
    if mw is None:
        return 0.5
    if 200 <= mw <= 500:
        return 1.0
    elif 150 <= mw <= 600:
        return 0.7
    else:
        return 0.3


async def predict_docking(
    compound_name: str,
    target_protein: str,
    compound_props: Optional[dict] = None,
) -> Dict[str, Any]:
    """
    Heuristic docking prediction between a compound and a protein target.

    If compound_props is not provided, fetches them from PubChem.
    Returns a scored prediction with component breakdown.
    """
    # Fetch properties if not provided
    if compound_props is None:
        try:
            from clients.pubchem import get_compound_properties
            compound_props = await get_compound_properties(compound_name)
        except Exception as exc:
            logger.warning("PubChem lookup failed for %s: %s", compound_name, exc)

    if compound_props is None:
        return {
            "compound": compound_name,
            "target": target_protein,
            "status": "no_data",
            "message": f"Could not retrieve molecular properties for '{compound_name}'",
            "overall_score": 0.0,
        }

    # Calculate component scores
    lipinski = _lipinski_score(compound_props)
    veber = _veber_score(compound_props)
    mw_fit = _mw_complementarity(compound_props.get("molecular_weight"))

    # Weighted composite score
    overall = round(lipinski * 0.4 + veber * 0.3 + mw_fit * 0.3, 3)

    # Classification
    if overall >= 0.8:
        tier = "favorable"
        interpretation = f"{compound_name} shows favorable drug-like properties for targeting {target_protein}."
    elif overall >= 0.5:
        tier = "moderate"
        interpretation = f"{compound_name} has moderate binding potential; some drug-likeness concerns."
    else:
        tier = "unfavorable"
        interpretation = f"{compound_name} may have poor bioavailability or binding properties for {target_protein}."

    # Estimate energy breakdown from molecular properties
    hbd = _to_float(compound_props.get("hbd")) or 0
    hba = _to_float(compound_props.get("hba")) or 0
    logp = _to_float(compound_props.get("xlogp")) or 0
    mw = _to_float(compound_props.get("molecular_weight")) or 300

    # Hydrogen bond score: each H-bond donor/acceptor contributes ~-1.5 kcal/mol
    hydrogen_bond_score = round(-1.5 * min(hbd + hba, 10) * overall, 2)
    # Hydrophobic score: correlates with LogP
    hydrophobic_score = round(-0.8 * min(max(logp, 0), 5) * overall, 2)
    # Electrostatic: rough estimate from polar surface area proxy
    electrostatic_score = round(-0.5 * min(hba * 0.3 + hbd * 0.4, 3) * overall, 2)
    # Overall binding energy estimate
    binding_energy_estimate = round(hydrogen_bond_score + hydrophobic_score + electrostatic_score, 2)

    return {
        "compound": compound_name,
        "target": target_protein,
        "status": "predicted",
        "smiles": compound_props.get("smiles", ""),
        "molecular_weight": compound_props.get("molecular_weight"),
        "xlogp": compound_props.get("xlogp"),
        "overall_score": overall,
        "tier": tier,
        "interpretation": interpretation,
        "component_scores": {
            "lipinski_compliance": round(lipinski, 3),
            "veber_bioavailability": round(veber, 3),
            "mw_complementarity": round(mw_fit, 3),
        },
        "energy_breakdown": {
            "binding_energy_estimate": binding_energy_estimate,
            "hydrogen_bond_score": hydrogen_bond_score,
            "hydrophobic_score": hydrophobic_score,
            "electrostatic_score": electrostatic_score,
        },
        "properties": {
            "hbd": compound_props.get("hbd"),
            "hba": compound_props.get("hba"),
            "rotatable_bonds": compound_props.get("rotatable_bonds"),
            "molecular_formula": compound_props.get("molecular_formula", ""),
        },
    }


async def batch_docking(
    compounds: List[str],
    target_protein: str,
) -> List[Dict[str, Any]]:
    """Run heuristic docking for multiple compounds against a target."""
    results = []
    for compound in compounds:
        result = await predict_docking(compound, target_protein)
        results.append(result)
    # Sort by score descending
    results.sort(key=lambda r: r.get("overall_score", 0), reverse=True)
    return results
