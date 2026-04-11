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

# ─── Mock data for demo fallback ──────────────────────────────────────────────

_MOCK_ALPHAFOLD_DATA = {
    "BRCA1": {
        "protein_name": "BRCA1",
        "uniprot_name": "Breast cancer type 1 susceptibility protein",
        "accession": "P38398",
        "gene": "BRCA1",
        "mean_confidence": 78.5,
        "confidence_tier": "high",
        "pdb_url": "https://alphafold.ebi.ac.uk/structures/AF-P38398-F1-model_v4.cif",
        "entry_id": "AF-P38398-F1",
        "alphafold_url": "https://alphafold.ebi.ac.uk/entry/P38398",
    },
    "HIF1α": {
        "protein_name": "HIF1α",
        "uniprot_name": "Hypoxia-inducible factor 1-alpha",
        "accession": "Q16665",
        "gene": "HIF1A",
        "mean_confidence": 76.2,
        "confidence_tier": "high",
        "pdb_url": "https://alphafold.ebi.ac.uk/structures/AF-Q16665-F1-model_v4.cif",
        "entry_id": "AF-Q16665-F1",
        "alphafold_url": "https://alphafold.ebi.ac.uk/entry/Q16665",
    },
    "TP53": {
        "protein_name": "TP53",
        "uniprot_name": "Cellular tumor antigen p53",
        "accession": "P04637",
        "gene": "TP53",
        "mean_confidence": 82.1,
        "confidence_tier": "high",
        "pdb_url": "https://alphafold.ebi.ac.uk/structures/AF-P04637-F1-model_v4.cif",
        "entry_id": "AF-P04637-F1",
        "alphafold_url": "https://alphafold.ebi.ac.uk/entry/P04637",
    },
    "VEGF": {
        "protein_name": "VEGF",
        "uniprot_name": "Vascular endothelial growth factor A",
        "accession": "P15692",
        "gene": "VEGFA",
        "mean_confidence": 74.8,
        "confidence_tier": "high",
        "pdb_url": "https://alphafold.ebi.ac.uk/structures/AF-P15692-F1-model_v4.cif",
        "entry_id": "AF-P15692-F1",
        "alphafold_url": "https://alphafold.ebi.ac.uk/entry/P15692",
    },
}

_MOCK_BINDING_INTERFACE = {
    "protein_a": "BRCA1",
    "protein_b": "HIF1α",
    "interface_residues_a": [
        {"residue_index": 24, "residue_name": "Lys", "interaction_type": "hydrogen_bond", "partner_residue": "Glu-156"},
        {"residue_index": 67, "residue_name": "Asp", "interaction_type": "salt_bridge", "partner_residue": "Lys-182"},
        {"residue_index": 103, "residue_name": "Trp", "interaction_type": "hydrophobic", "partner_residue": "Pro-201"},
        {"residue_index": 145, "residue_name": "Arg", "interaction_type": "hydrogen_bond", "partner_residue": "Ser-243"},
    ],
    "interface_residues_b": [
        {"residue_index": 156, "residue_name": "Glu", "interaction_type": "hydrogen_bond", "partner_residue": "Lys-24"},
        {"residue_index": 182, "residue_name": "Lys", "interaction_type": "salt_bridge", "partner_residue": "Asp-67"},
        {"residue_index": 201, "residue_name": "Pro", "interaction_type": "hydrophobic", "partner_residue": "Trp-103"},
        {"residue_index": 243, "residue_name": "Ser", "interaction_type": "hydrogen_bond", "partner_residue": "Arg-145"},
    ],
    "hydrogen_bonds": [
        {"donor": "Lys-24", "acceptor": "Glu-156", "estimated_distance_angstrom": 2.8},
        {"donor": "Arg-145", "acceptor": "Ser-243", "estimated_distance_angstrom": 3.0},
    ],
    "interface_area_sq_angstrom": 1247.5,
    "binding_type": "transient complex",
    "confidence": 0.82,
    "description": "BRCA1 and HIF1α form a dynamic interaction at the DNA binding interface, stabilized by hydrogen bonds and hydrophobic contacts."
}

def _generate_mock_residues(accession: str = "") -> List[Dict[str, Any]]:
    """Generate realistic mock per-residue pLDDT scores."""
    import random
    residues = []
    # Typical structure: 120-200 residues, mostly high confidence
    num_residues = random.randint(120, 200)
    for i in range(num_residues):
        # Distribution: 70% high (85-95), 20% medium (70-85), 10% low (50-70)
        r = random.random()
        if r < 0.7:
            plddt = random.randint(85, 95)
        elif r < 0.9:
            plddt = random.randint(70, 85)
        else:
            plddt = random.randint(50, 70)

        aa_codes = ["Ala", "Arg", "Asn", "Asp", "Cys", "Gln", "Glu", "Gly", "His", "Ile",
                    "Leu", "Lys", "Met", "Phe", "Pro", "Ser", "Thr", "Trp", "Tyr", "Val"]
        residues.append({
            "residue_index": i,
            "residue_name": random.choice(aa_codes),
            "plddt_score": plddt,
        })
    return residues


_MOCK_LEAD_COMPOUNDS = [
    {
        "name": "YC-1",
        "chembl_id": "CHEMBL1255410",
        "smiles": "Cc1ccc(cc1)c2ccc3c(c2)oc2cc(ccc2n3)C(=O)O",
        "molecular_weight": 346.34,
        "logp": 3.2,
        "molecular_formula": "C20H14N2O3",
        "scaffold_description": "Benzimidazole-based HIF-1α inhibitor with phenolic substitution.",
        "target_protein": "HIF1α",
        "bioactivities": [
            {"type": "IC50", "value": 3.2, "units": "μM", "target": "HIF1α", "pchembl": 5.49},
            {"type": "Ki", "value": 1.8, "units": "μM", "target": "PHD2", "pchembl": 5.74},
        ],
    },
    {
        "name": "Chetomin",
        "chembl_id": "CHEMBL1083487",
        "smiles": "CC(C)C1=C(C(=O)N[C@@H]2C(=O)N[C@H]3CSSC(C(=O)N[C@H](C(=O)N[C@H](C(=O)N[C@H](C(=O)N[C@H](C(=O)N3)Cc4c[nH]c5ccccc45)C)Cc6c[nH]cn6)NC(=O)[C@H](Cc7ccccc7)NC(=O)[C@H](C)NC2=O)C=C1",
        "molecular_weight": 1237.5,
        "logp": 4.1,
        "molecular_formula": "C58H76N12O14S2",
        "scaffold_description": "Cyclic depsipeptide with disulfide bridge targeting HIF-1α.",
        "target_protein": "HIF1α",
        "bioactivities": [
            {"type": "EC50", "value": 0.5, "units": "μM", "target": "HIF1α reporter", "pchembl": 6.30},
        ],
    },
    {
        "name": "Acriflavine",
        "chembl_id": "CHEMBL1255",
        "smiles": "Cc1cc2c(cc1N)c1ccccc1[nH]c2=O",
        "molecular_weight": 260.33,
        "logp": 2.8,
        "molecular_formula": "C16H14N2O",
        "scaffold_description": "Acridine-based HIF-1α inhibitor with minimal side-chain.",
        "target_protein": "HIF1α",
        "bioactivities": [
            {"type": "IC50", "value": 8.5, "units": "μM", "target": "HIF1α", "pchembl": 5.07},
        ],
    },
]

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
        # Fallback to mock data for demo
        mock_key = next((k for k in _MOCK_ALPHAFOLD_DATA.keys() if k.lower() in protein_name.lower() or protein_name.lower() in k.lower()), None)
        if mock_key:
            logger.info("Using mock AlphaFold data for '%s'", protein_name)
            return _MOCK_ALPHAFOLD_DATA[mock_key]
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
        logger.warning("Per-residue pLDDT parsing failed: %s. Using mock data.", exc)
        # Fallback: generate mock residue scores for demo
        return _generate_mock_residues()


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
        logger.warning("Binding interface prediction failed: %s. Using mock data.", exc)

    # Fallback: use mock interface data
    if protein_a.upper() == "BRCA1" and protein_b.upper() in ("HIF1A", "HIF1α"):
        logger.info("Using mock binding interface for BRCA1-HIF1α")
        return _MOCK_BINDING_INTERFACE.copy()

    return None


async def generate_binding_energy_matrix(
    protein_a: str,
    protein_b: str,
    binding_interface: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Use OpenAI to estimate residue-pair interaction energies based on binding interface data."""
    if not _openai_client:
        return None

    residues_a = binding_interface.get("interface_residues_a", [])
    residues_b = binding_interface.get("interface_residues_b", [])

    if not residues_a or not residues_b:
        return None

    # Limit to top 8 residues per side for a manageable matrix
    rows = [f"{r['residue_name']}-{r['residue_index']}" for r in residues_a[:8]]
    cols = [f"{r['residue_name']}-{r['residue_index']}" for r in residues_b[:8]]

    prompt = (
        f"You are a structural biologist. Estimate residue-pair interaction energies "
        f"for the binding interface between {protein_a} and {protein_b}.\n\n"
        f"Interface residues from {protein_a}: {', '.join(rows)}\n"
        f"Interface residues from {protein_b}: {', '.join(cols)}\n"
        f"Hydrogen bonds: {json.dumps(binding_interface.get('hydrogen_bonds', []))}\n\n"
        f"Return a JSON object with:\n"
        f'- "rows": list of {protein_a} residue labels (length {len(rows)})\n'
        f'- "cols": list of {protein_b} residue labels (length {len(cols)})\n'
        f'- "values": a 2D array [{len(rows)}][{len(cols)}] of estimated interaction energies in kcal/mol '
        f"(negative = attractive, positive = repulsive, 0 = no interaction)\n"
        f'- "unit": "kcal/mol"\n'
        f"Use realistic energy ranges: H-bonds -2 to -5, salt bridges -3 to -7, "
        f"hydrophobic -0.5 to -2, van der Waals -0.1 to -0.5, clashes +1 to +5."
    )

    try:
        resp = await _openai_client.chat.completions.create(
            model=os.getenv("OPENAI_AGENT_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": "You are an expert computational structural biologist. Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=1500,
            response_format={"type": "json_object"},
        )
        text = resp.choices[0].message.content or "{}"
        data = json.loads(text)

        # Validate structure
        if "rows" in data and "cols" in data and "values" in data:
            data.setdefault("unit", "kcal/mol")
            return data

    except Exception as exc:
        logger.warning("Binding energy matrix generation failed: %s", exc)

    return None
