"""
Rich mock data for BioStream — 8 scientifically plausible studies.
Used as pre-populated cache on startup and as fallback when the live API
or AI processing is unavailable.
"""
from __future__ import annotations

from models import Author, AnnotatedText, Entity, Link, Study

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _a(name: str, affil: str) -> Author:
    return Author(name=name, affiliation=affil)


def _l(url: str, ltype: str = "url", desc: str = "") -> Link:
    return Link(url=url, type=ltype, description=desc or None)


def _e(
    eid: str,
    text: str,
    etype: str,
    conf: float,
    mentions: int,
    snippet: str,
    flagged: bool = False,
) -> Entity:
    return Entity(
        id=eid,
        text=text,
        type=etype,  # type: ignore[arg-type]
        confidence=conf,
        mentions=mentions,
        source_text=snippet,
        flagged=flagged,
    )


# ---------------------------------------------------------------------------
# Study 1 — BRCA1/BRCA2 breast cancer
# ---------------------------------------------------------------------------

STUDY_1 = Study(
    accession="S-EPMC3521001",
    title="BRCA1 and BRCA2 mutations in breast and ovarian cancer: implications for targeted therapy",
    release_date="2013-01-15",
    authors=[
        _a("King MC", "University of Washington, Seattle, WA"),
        _a("Marks JH", "Creighton University School of Medicine, Omaha, NE"),
        _a("Mandell JB", "National Cancer Institute, Bethesda, MD"),
    ],
    links=[
        _l("https://europepmc.org/article/PMC/3521001", "url", "Europe PMC"),
        _l("https://doi.org/10.1126/science.1088759", "url", "DOI"),
        _l("https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3521001/", "url", "PubMed Central"),
    ],
    abstract=(
        "Germline mutations in BRCA1 and BRCA2 confer significantly elevated lifetime risks of "
        "breast and ovarian cancer. This study characterises the functional consequences of 127 "
        "novel BRCA1 missense variants using a saturation genome editing approach. We demonstrate "
        "that loss-of-function mutations concentrate in the RING and BRCT domains of BRCA1, while "
        "BRCA2 mutations predominantly affect the DNA-binding domain. PARP inhibitor olaparib "
        "exploits homologous recombination deficiency (HRD) in BRCA1/2-mutant tumours, achieving "
        "a 59% objective response rate in platinum-sensitive ovarian cancer. CDK12 co-mutations "
        "were identified as a secondary resistance mechanism. These findings have direct "
        "implications for germline testing guidelines and PARP inhibitor eligibility criteria."
    ),
    hypothesis=(
        "Loss-of-function mutations in BRCA1 and BRCA2 drive hereditary breast and ovarian cancer "
        "by impairing homologous recombination, making these tumours selectively vulnerable to "
        "PARP inhibitor therapy via synthetic lethality."
    ),
    primary_target="BRCA1",
    entities=[
        _e("gene-brca1", "BRCA1", "gene", 0.97, 18, "…BRCA1 missense variants using saturation genome editing…"),
        _e("gene-brca2", "BRCA2", "gene", 0.96, 14, "…BRCA2 mutations predominantly affect the DNA-binding domain…"),
        _e("compound-olaparib", "olaparib", "compound", 0.93, 7, "…PARP inhibitor olaparib exploits homologous recombination deficiency…"),
        _e("protein-parp", "PARP protein", "protein", 0.89, 9, "…PARP inhibitor olaparib exploits HRD in BRCA1/2-mutant tumours…"),
        _e("gene-cdk12", "CDK12", "gene", 0.82, 3, "…CDK12 co-mutations were identified as a secondary resistance mechanism…"),
        _e("disease-ovarian", "ovarian cancer", "disease", 0.91, 6, "…platinum-sensitive ovarian cancer achieving 59% objective response rate…"),
        _e("disease-breast", "breast cancer", "disease", 0.91, 5, "…elevated lifetime risks of breast and ovarian cancer…"),
        _e("pathway-hr", "homologous recombination pathway", "pathway", 0.86, 4, "…impairing homologous recombination, making tumours vulnerable…"),
    ],
    confidence_score=0.87,
    s3_key="raw/studies/S-EPMC3521001.json",
    processing_status="complete",
)

# ---------------------------------------------------------------------------
# Study 2 — ACE2 / SARS-CoV-2
# ---------------------------------------------------------------------------

STUDY_2 = Study(
    accession="S-EPMC5419984",
    title="ACE2 receptor expression and SARS-CoV-2 entry mechanisms in human lung tissue",
    release_date="2020-05-12",
    authors=[
        _a("Hoffmann M", "Deutsches Primatenzentrum GmbH, Göttingen"),
        _a("Kleine-Weber H", "Georg-August-Universität Göttingen"),
        _a("Pöhlmann S", "Deutsches Primatenzentrum GmbH, Göttingen"),
    ],
    links=[
        _l("https://europepmc.org/article/PMC/5419984", "url", "Europe PMC"),
        _l("https://doi.org/10.1016/j.cell.2020.02.052", "url", "Cell DOI"),
        _l("https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5419984/", "url", "PubMed Central"),
    ],
    abstract=(
        "SARS-CoV-2 utilises the ACE2 receptor as its primary cellular entry receptor. "
        "The viral spike protein binds ACE2 with ~10-fold higher affinity than SARS-CoV-1 spike. "
        "TMPRSS2 serine protease primes the spike protein at the S1/S2 cleavage site, facilitating "
        "membrane fusion and viral entry into type II pneumocytes. Camostat mesylate, a TMPRSS2 "
        "inhibitor approved in Japan for pancreatitis, blocks SARS-CoV-2 entry in human airway "
        "epithelial cells. Single-cell RNA sequencing of 13 human lung donors reveals ACE2 "
        "co-expression with TMPRSS2 in 0.64% of all lung cells, predominantly AT2 cells. "
        "Neutralising antibody CR3022 cross-reacts with the SARS-CoV-2 receptor-binding domain."
    ),
    hypothesis=(
        "SARS-CoV-2 exploits high-affinity ACE2 binding coupled with TMPRSS2-mediated spike "
        "priming to achieve efficient entry into human alveolar epithelial cells, explaining "
        "its enhanced transmissibility relative to SARS-CoV-1."
    ),
    primary_target="ACE2",
    entities=[
        _e("protein-ace2", "ACE2 receptor", "protein", 0.96, 12, "…SARS-CoV-2 utilises the ACE2 receptor as its primary cellular entry receptor…"),
        _e("protein-tmprss2", "TMPRSS2 serine protease", "protein", 0.94, 8, "…TMPRSS2 serine protease primes the spike protein at the S1/S2 cleavage site…"),
        _e("protein-spike", "spike protein", "protein", 0.93, 10, "…viral spike protein binds ACE2 with ~10-fold higher affinity…"),
        _e("compound-camostat", "camostat mesylate", "compound", 0.91, 4, "…Camostat mesylate, a TMPRSS2 inhibitor approved in Japan…"),
        _e("gene-ace2-gene", "ACE2", "gene", 0.88, 6, "…ACE2 co-expression with TMPRSS2 in 0.64% of all lung cells…"),
        _e("gene-tmprss2-gene", "TMPRSS2", "gene", 0.87, 7, "…ACE2 co-expression with TMPRSS2 in 0.64% of all lung cells…"),
        _e("disease-covid", "COVID-19 disease", "disease", 0.85, 3, "…SARS-CoV-2 entry into human airway epithelial cells…"),
    ],
    confidence_score=0.91,
    s3_key="raw/studies/S-EPMC5419984.json",
    processing_status="complete",
)

# ---------------------------------------------------------------------------
# Study 3 — Alzheimer's / tau / amyloid-beta
# ---------------------------------------------------------------------------

STUDY_3 = Study(
    accession="S-EPMC7654321",
    title="Tau protein hyperphosphorylation and amyloid-beta aggregation in Alzheimer's disease pathogenesis",
    release_date="2021-03-22",
    authors=[
        _a("Selkoe DJ", "Harvard Medical School, Boston, MA"),
        _a("Hardy J", "UCL Institute of Neurology, London, UK"),
        _a("Bhatt DL", "Brigham and Women's Hospital, Boston, MA"),
    ],
    links=[
        _l("https://europepmc.org/article/PMC/7654321", "url", "Europe PMC"),
        _l("https://doi.org/10.1016/j.neuron.2021.01.015", "url", "Neuron DOI"),
    ],
    abstract=(
        "Alzheimer's disease (AD) is characterised by two hallmark pathologies: extracellular "
        "amyloid-beta (Aβ) plaques and intraneuronal tau neurofibrillary tangles. GSK3B kinase "
        "and CDK5 are the primary tau kinases responsible for hyperphosphorylation at Ser202/Thr205 "
        "(AT8 epitope) and Ser396 residues. APP processing by BACE1 (beta-secretase) and gamma-"
        "secretase generates the amyloidogenic Aβ42 peptide. Lecanemab, an anti-Aβ protofibril "
        "antibody, reduced brain amyloid burden by 59% and slowed clinical decline by 27% in a "
        "phase 3 trial. APOE4 allele carriers show accelerated Aβ deposition and impaired "
        "microglial-mediated clearance. TREM2 expression on microglia is critical for amyloid "
        "plaque compaction and neuroinflammation resolution."
    ),
    hypothesis=(
        "Hyperphosphorylation of tau by GSK3B and CDK5 kinases, combined with BACE1-driven "
        "amyloid-beta production, creates a self-reinforcing pathological cascade in Alzheimer's "
        "disease that can be interrupted by targeted anti-amyloid immunotherapy."
    ),
    primary_target="tau protein",
    entities=[
        _e("protein-tau", "tau protein", "protein", 0.96, 11, "…tau neurofibrillary tangles…tau hyperphosphorylation at Ser202/Thr205…"),
        _e("protein-gsk3b", "GSK3B kinase", "protein", 0.93, 5, "…GSK3B kinase and CDK5 are the primary tau kinases…"),
        _e("protein-bace1", "BACE1 beta-secretase", "protein", 0.91, 4, "…APP processing by BACE1 (beta-secretase) generates Aβ42…"),
        _e("gene-app", "APP", "gene", 0.88, 4, "…APP processing by BACE1 (beta-secretase) and gamma-secretase…"),
        _e("gene-apoe4", "APOE4", "gene", 0.86, 3, "…APOE4 allele carriers show accelerated Aβ deposition…"),
        _e("gene-trem2", "TREM2", "gene", 0.84, 3, "…TREM2 expression on microglia is critical for amyloid plaque compaction…"),
        _e("compound-lecanemab", "lecanemab", "compound", 0.92, 3, "…Lecanemab, an anti-Aβ protofibril antibody, reduced brain amyloid burden by 59%…"),
        _e("disease-alzheimer", "Alzheimer's disease", "disease", 0.95, 8, "…Alzheimer's disease (AD) is characterised by two hallmark pathologies…"),
    ],
    confidence_score=0.89,
    s3_key="raw/studies/S-EPMC7654321.json",
    processing_status="complete",
)

# ---------------------------------------------------------------------------
# Study 4 — CRISPR / PCSK9
# ---------------------------------------------------------------------------

STUDY_4 = Study(
    accession="S-EPMC8901234",
    title="CRISPR-Cas9 genome editing of the PCSK9 gene for durable LDL cholesterol reduction",
    release_date="2022-07-08",
    authors=[
        _a("Musunuru K", "University of Pennsylvania Perelman School of Medicine"),
        _a("Bernstein D", "Stanford Cardiovascular Institute"),
        _a("Liu DR", "Broad Institute of MIT and Harvard"),
    ],
    links=[
        _l("https://europepmc.org/article/PMC/8901234", "url", "Europe PMC"),
        _l("https://doi.org/10.1056/NEJMoa2201536", "url", "NEJM DOI"),
        _l("https://clinicaltrials.gov/ct2/show/NCT04601051", "data", "Clinical Trial"),
    ],
    abstract=(
        "Proprotein convertase subtilisin/kexin type 9 (PCSK9) is a serine protease that "
        "degrades hepatic LDL receptors (LDLR), raising plasma LDL-C levels. In vivo "
        "CRISPR-Cas9 editing using lipid nanoparticle (LNP) delivery targeting PCSK9 exon 7 "
        "achieved 67% hepatic editing efficiency in cynomolgus monkeys and sustained 60% LDL-C "
        "reduction at 12 months. SpCas9 mRNA and sgRNA co-formulated in ionisable LNPs showed "
        "superior liver tropism compared to AAV vectors. Off-target analysis by GUIDE-seq "
        "identified no significant editing at predicted off-target sites. Evolocumab and "
        "alirocumab (anti-PCSK9 mAbs) require bimonthly dosing, whereas a single CRISPR "
        "treatment may offer a permanent therapeutic effect for familial hypercholesterolaemia."
    ),
    hypothesis=(
        "Single-administration in vivo CRISPR-Cas9 editing of PCSK9 in hepatocytes can achieve "
        "durable, near-permanent LDL cholesterol reduction, potentially superseding chronic "
        "anti-PCSK9 monoclonal antibody therapy for familial hypercholesterolaemia."
    ),
    primary_target="PCSK9",
    entities=[
        _e("gene-pcsk9", "PCSK9", "gene", 0.97, 14, "…CRISPR-Cas9 editing of PCSK9 exon 7 achieved 67% hepatic editing…"),
        _e("protein-ldlr", "LDL receptor", "protein", 0.92, 5, "…PCSK9 is a serine protease that degrades hepatic LDL receptors…"),
        _e("protein-spcas9", "SpCas9", "protein", 0.90, 4, "…SpCas9 mRNA and sgRNA co-formulated in ionisable LNPs…"),
        _e("compound-evolocumab", "evolocumab", "compound", 0.88, 2, "…Evolocumab and alirocumab (anti-PCSK9 mAbs) require bimonthly dosing…"),
        _e("compound-alirocumab", "alirocumab", "compound", 0.87, 2, "…Evolocumab and alirocumab (anti-PCSK9 mAbs) require bimonthly dosing…"),
        _e("disease-fh", "familial hypercholesterolaemia", "disease", 0.89, 3, "…permanent therapeutic effect for familial hypercholesterolaemia…"),
    ],
    confidence_score=0.88,
    s3_key="raw/studies/S-EPMC8901234.json",
    processing_status="complete",
)

# ---------------------------------------------------------------------------
# Study 5 — PD-1/PD-L1 checkpoint resistance in NSCLC
# ---------------------------------------------------------------------------

STUDY_5 = Study(
    accession="S-EPMC9112345",
    title="PD-1/PD-L1 checkpoint inhibitor resistance mechanisms in non-small cell lung cancer",
    release_date="2022-11-30",
    authors=[
        _a("Topalian SL", "Johns Hopkins Sidney Kimmel Cancer Center"),
        _a("Hodi FS", "Dana-Farber Cancer Institute, Boston, MA"),
        _a("Wolchok JD", "Memorial Sloan Kettering Cancer Center, New York, NY"),
    ],
    links=[
        _l("https://europepmc.org/article/PMC/9112345", "url", "Europe PMC"),
        _l("https://doi.org/10.1038/s41591-022-01694-6", "url", "Nature Medicine DOI"),
    ],
    abstract=(
        "Immune checkpoint inhibitors (ICIs) targeting PD-1 and PD-L1 have transformed the "
        "treatment of non-small cell lung cancer (NSCLC), yet durable responses occur in fewer "
        "than 30% of patients. KRAS G12C mutation co-occurring with STK11 loss-of-function "
        "creates an immunosuppressive tumour microenvironment characterised by reduced CD8+ T cell "
        "infiltration and elevated IL-6/STAT3 signalling. Pembrolizumab (anti-PD-1) and "
        "nivolumab (anti-PD-1) demonstrate comparable efficacy in PD-L1 ≥50% patients. "
        "Tumour mutational burden (TMB) ≥10 mut/Mb independently predicts ICI benefit. "
        "Sotorasib, a covalent KRASG12C inhibitor, synergises with pembrolizumab in STK11 wild-"
        "type NSCLC. JAK1/JAK2 loss-of-function mutations underlie acquired resistance through "
        "impaired IFN-γ signalling and MHC-I downregulation."
    ),
    hypothesis=(
        "Co-occurring KRAS G12C and STK11 mutations suppress anti-tumour immunity in NSCLC by "
        "remodelling the tumour microenvironment, and combining KRASG12C inhibitors with PD-1 "
        "blockade can partially restore immune checkpoint sensitivity."
    ),
    primary_target="PD-1",
    entities=[
        _e("gene-kras", "KRAS", "gene", 0.95, 8, "…KRAS G12C mutation co-occurring with STK11 loss-of-function…"),
        _e("gene-stk11", "STK11", "gene", 0.92, 5, "…STK11 loss-of-function creates immunosuppressive tumour microenvironment…"),
        _e("protein-pd1", "PD-1 receptor", "protein", 0.94, 9, "…ICIs targeting PD-1 and PD-L1 have transformed the treatment…"),
        _e("protein-pdl1", "PD-L1 protein", "protein", 0.93, 7, "…immune checkpoint inhibitors targeting PD-1 and PD-L1…"),
        _e("compound-pembrolizumab", "pembrolizumab", "compound", 0.92, 5, "…Pembrolizumab (anti-PD-1) and nivolumab demonstrate comparable efficacy…"),
        _e("compound-nivolumab", "nivolumab", "compound", 0.91, 4, "…Pembrolizumab (anti-PD-1) and nivolumab (anti-PD-1)…"),
        _e("compound-sotorasib", "sotorasib", "compound", 0.89, 3, "…Sotorasib, a covalent KRASG12C inhibitor, synergises with pembrolizumab…"),
        _e("disease-nsclc", "lung cancer", "disease", 0.93, 6, "…treatment of non-small cell lung cancer (NSCLC)…"),
        _e("gene-jak1", "JAK1", "gene", 0.84, 2, "…JAK1/JAK2 loss-of-function mutations underlie acquired resistance…"),
    ],
    confidence_score=0.90,
    s3_key="raw/studies/S-EPMC9112345.json",
    processing_status="complete",
)

# ---------------------------------------------------------------------------
# Study 6 — mTOR pathway in renal cell carcinoma
# ---------------------------------------------------------------------------

STUDY_6 = Study(
    accession="S-EPMC9334567",
    title="mTOR pathway activation and everolimus resistance in clear cell renal cell carcinoma",
    release_date="2023-02-14",
    authors=[
        _a("Bhatt RS", "Beth Israel Deaconess Medical Center, Boston, MA"),
        _a("Choueiri TK", "Dana-Farber Cancer Institute, Boston, MA"),
        _a("Motzer RJ", "Memorial Sloan Kettering Cancer Center, New York, NY"),
    ],
    links=[
        _l("https://europepmc.org/article/PMC/9334567", "url", "Europe PMC"),
        _l("https://doi.org/10.1200/JCO.22.01547", "url", "JCO DOI"),
    ],
    abstract=(
        "The mTOR (mechanistic target of rapamycin) pathway is aberrantly activated in 30-40% "
        "of clear cell renal cell carcinomas (ccRCC) through VHL/HIF1A/VEGF axis dysregulation "
        "and PIK3CA/PTEN mutations. Everolimus (mTORC1 inhibitor) prolongs progression-free "
        "survival but acquired resistance emerges via mTORC2 reactivation and AKT pathway "
        "feedback loops. Combination therapy with axitinib (VEGFR inhibitor) restored "
        "everolimus sensitivity in patient-derived organoids harbouring TSC1 mutations. "
        "Single-cell proteomics identified phospho-S6K1 and phospho-4EBP1 as resistance "
        "biomarkers. Nivolumab plus ipilimumab demonstrated superior OS (median 47.0 vs 26.6 "
        "months) compared to sunitinib in intermediate/poor-risk ccRCC in CheckMate 214."
    ),
    hypothesis=(
        "Acquired resistance to mTORC1 inhibition in ccRCC is driven by compensatory mTORC2 "
        "and AKT pathway reactivation, which can be circumvented by combining everolimus with "
        "VEGFR-targeted agents or dual mTORC1/2 inhibitors."
    ),
    primary_target="mTOR",
    entities=[
        _e("protein-mtor", "mTOR kinase", "protein", 0.94, 10, "…mTOR (mechanistic target of rapamycin) pathway is aberrantly activated…"),
        _e("gene-vhl", "VHL", "gene", 0.90, 4, "…VHL/HIF1A/VEGF axis dysregulation…"),
        _e("gene-pik3ca", "PIK3CA", "gene", 0.88, 3, "…PIK3CA/PTEN mutations…"),
        _e("gene-pten", "PTEN", "gene", 0.87, 3, "…PIK3CA/PTEN mutations…"),
        _e("compound-everolimus", "everolimus", "compound", 0.92, 6, "…Everolimus (mTORC1 inhibitor) prolongs progression-free survival…"),
        _e("compound-axitinib", "axitinib", "compound", 0.88, 3, "…combination therapy with axitinib (VEGFR inhibitor) restored sensitivity…"),
        _e("compound-sunitinib", "sunitinib", "compound", 0.86, 2, "…compared to sunitinib in intermediate/poor-risk ccRCC…"),
        _e("disease-rcc", "renal cell carcinoma", "disease", 0.91, 5, "…clear cell renal cell carcinomas (ccRCC)…"),
        _e("pathway-mtor", "mTOR signaling pathway", "pathway", 0.87, 7, "…mTOR pathway is aberrantly activated in 30-40% of ccRCC…"),
    ],
    confidence_score=0.86,
    s3_key="raw/studies/S-EPMC9334567.json",
    processing_status="complete",
)

# ---------------------------------------------------------------------------
# Study 7 — CAR-T cell therapy in B-cell lymphoma
# ---------------------------------------------------------------------------

STUDY_7 = Study(
    accession="S-EPMC9567890",
    title="CD19-directed CAR-T cell therapy and cytokine release syndrome management in diffuse large B-cell lymphoma",
    release_date="2023-06-01",
    authors=[
        _a("Neelapu SS", "MD Anderson Cancer Center, Houston, TX"),
        _a("Locke FL", "Moffitt Cancer Center, Tampa, FL"),
        _a("Bartlett NL", "Washington University School of Medicine, St. Louis, MO"),
    ],
    links=[
        _l("https://europepmc.org/article/PMC/9567890", "url", "Europe PMC"),
        _l("https://doi.org/10.1056/NEJMoa1707447", "url", "NEJM DOI"),
        _l("https://clinicaltrials.gov/ct2/show/NCT02348216", "data", "ZUMA-1 Trial"),
    ],
    abstract=(
        "Axicabtagene ciloleucel (axi-cel), a CD19-directed chimeric antigen receptor T-cell "
        "(CAR-T) therapy, demonstrated a 54% complete response rate and 58% 5-year overall "
        "survival in relapsed/refractory diffuse large B-cell lymphoma (DLBCL) in the ZUMA-1 "
        "trial. CD19 antigen loss and CAR-T cell exhaustion through LAG-3 and TIM-3 upregulation "
        "are primary resistance mechanisms. Cytokine release syndrome (CRS) and immune effector "
        "cell-associated neurotoxicity syndrome (ICANS) occurred in 93% and 64% of patients, "
        "respectively. Tocilizumab (anti-IL-6R antibody) and corticosteroids are the standard "
        "of care for grade ≥3 CRS management. IL-6 and ferritin levels serve as predictive "
        "biomarkers for severe CRS. CD4:CD8 ratio in the infusion product predicts durable "
        "remission."
    ),
    hypothesis=(
        "CD19-directed CAR-T cell therapy achieves durable remissions in DLBCL through sustained "
        "cytotoxic T-cell activity against CD19+ malignant B-cells, with tocilizumab-mediated "
        "IL-6 receptor blockade effectively mitigating potentially life-threatening cytokine "
        "release syndrome."
    ),
    primary_target="CD19",
    entities=[
        _e("protein-cd19", "CD19 receptor", "protein", 0.95, 9, "…CD19-directed chimeric antigen receptor T-cell therapy…"),
        _e("compound-axicab", "axicabtagene ciloleucel", "compound", 0.93, 5, "…Axicabtagene ciloleucel (axi-cel), a CD19-directed CAR-T therapy…"),
        _e("compound-tocilizumab", "tocilizumab", "compound", 0.91, 4, "…Tocilizumab (anti-IL-6R antibody) and corticosteroids…"),
        _e("protein-lag3", "LAG-3 protein", "protein", 0.86, 2, "…CAR-T cell exhaustion through LAG-3 and TIM-3 upregulation…"),
        _e("protein-tim3", "TIM-3 protein", "protein", 0.85, 2, "…CAR-T cell exhaustion through LAG-3 and TIM-3 upregulation…"),
        _e("gene-il6", "IL6", "gene", 0.88, 4, "…IL-6 and ferritin levels serve as predictive biomarkers for severe CRS…"),
        _e("disease-dlbcl", "diffuse large B-cell lymphoma", "disease", 0.93, 6, "…relapsed/refractory diffuse large B-cell lymphoma (DLBCL)…"),
    ],
    confidence_score=0.88,
    s3_key="raw/studies/S-EPMC9567890.json",
    processing_status="complete",
)

# ---------------------------------------------------------------------------
# Study 8 — EGFR-mutant NSCLC / osimertinib
# ---------------------------------------------------------------------------

STUDY_8 = Study(
    accession="S-EPMC9789012",
    title="Osimertinib efficacy in EGFR-mutant NSCLC and mechanisms of acquired T790M resistance",
    release_date="2023-09-15",
    authors=[
        _a("Mok TS", "The Chinese University of Hong Kong"),
        _a("Wu YL", "Guangdong Lung Cancer Institute, China"),
        _a("Ahn MJ", "Samsung Medical Center, Seoul, South Korea"),
    ],
    links=[
        _l("https://europepmc.org/article/PMC/9789012", "url", "Europe PMC"),
        _l("https://doi.org/10.1056/NEJMoa1713137", "url", "NEJM DOI"),
    ],
    abstract=(
        "Osimertinib, a third-generation EGFR tyrosine kinase inhibitor (TKI), irreversibly "
        "inhibits both EGFR sensitising mutations (exon 19 deletions, L858R) and the T790M "
        "resistance mutation in non-small cell lung cancer (NSCLC). In the FLAURA trial, "
        "osimertinib demonstrated a median progression-free survival of 18.9 months versus "
        "10.2 months for first-generation TKIs (gefitinib/erlotinib). Acquired resistance "
        "mechanisms include EGFR C797S mutation, MET amplification, HER2 amplification, "
        "and histological transformation to small cell lung cancer. Amivantamab (anti-EGFR/"
        "MET bispecific antibody) combined with lazertinib overcomes C797S-mediated resistance "
        "in preclinical models. Brain metastasis penetration is markedly superior with "
        "osimertinib (CNS ORR 91%) owing to its lipophilic structure. Plasma ctDNA monitoring "
        "of EGFR mutations enables early detection of acquired resistance."
    ),
    hypothesis=(
        "Third-generation EGFR inhibitor osimertinib overcomes T790M-mediated acquired "
        "resistance by irreversible covalent binding to the EGFR kinase domain, while "
        "emerging C797S mutations and MET amplification represent the dominant subsequent "
        "resistance pathways requiring combination therapeutic strategies."
    ),
    primary_target="EGFR",
    entities=[
        _e("gene-egfr", "EGFR", "gene", 0.97, 15, "…EGFR sensitising mutations (exon 19 deletions, L858R) and T790M resistance…"),
        _e("compound-osimertinib", "osimertinib", "compound", 0.95, 10, "…Osimertinib, a third-generation EGFR tyrosine kinase inhibitor…"),
        _e("compound-gefitinib", "gefitinib", "compound", 0.88, 2, "…first-generation TKIs (gefitinib/erlotinib)…"),
        _e("compound-erlotinib", "erlotinib", "compound", 0.87, 2, "…first-generation TKIs (gefitinib/erlotinib)…"),
        _e("compound-amivantamab", "amivantamab", "compound", 0.89, 2, "…Amivantamab (anti-EGFR/MET bispecific antibody) combined with lazertinib…"),
        _e("gene-met", "MET", "gene", 0.90, 4, "…MET amplification, HER2 amplification, and histological transformation…"),
        _e("gene-her2", "HER2", "gene", 0.88, 3, "…MET amplification, HER2 amplification…"),
        _e("protein-egfr-protein", "EGFR tyrosine kinase", "protein", 0.93, 8, "…irreversible covalent binding to the EGFR kinase domain…"),
        _e("disease-nsclc-egfr", "lung cancer", "disease", 0.92, 7, "…non-small cell lung cancer (NSCLC)…"),
    ],
    confidence_score=0.91,
    s3_key="raw/studies/S-EPMC9789012.json",
    processing_status="complete",
)

# ---------------------------------------------------------------------------
# Exported collection
# ---------------------------------------------------------------------------

ALL_STUDIES: list[Study] = [
    STUDY_1,
    STUDY_2,
    STUDY_3,
    STUDY_4,
    STUDY_5,
    STUDY_6,
    STUDY_7,
    STUDY_8,
]

STUDIES_BY_ACCESSION: dict[str, Study] = {s.accession: s for s in ALL_STUDIES}
