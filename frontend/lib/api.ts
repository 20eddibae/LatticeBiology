// ─── Types ───────────────────────────────────────────────────────────────────

export interface Relationship {
  sourceEntity: string;
  targetEntity: string;
  relationshipType: "activates" | "inhibits" | "binds_to" | "upregulates" | "downregulates" | "associated_with";
  confidence: number;
  evidenceSnippet?: string;
  sourceCount?: number;
}

export interface Author {
  name: string;
  affiliation?: string;
}

export interface Link {
  url: string;
  type: string;
  description?: string;
}

export interface Study {
  accession: string;
  title: string;
  releaseDate: string;
  authorCount: number;
  confidenceScore: number;
  entityCounts: {
    proteins: number;
    genes: number;
    compounds: number;
  };
  primaryTarget?: string;
  abstract?: string;
  hypothesis?: string;
  entities?: Entity[];
  relationships?: Relationship[];
  authors?: Author[];
  links?: Link[];
  sourceUrl?: string;  // Deep link to EBI BioStudies
  pmid?: string;  // PubMed ID
}

export interface Entity {
  id: string;
  text: string;
  type: "protein" | "gene" | "compound" | "disease" | "pathway";
  confidence: number;
  mentions: number;
  start?: number;
  end?: number;
  source?: string;
  description?: string;
}

export interface StudyWithEntities extends Study {
  rawText: string;
  entities: Entity[];
}

export interface PipelineStage {
  id: string;
  label: string;
  source: string;
  status: "active" | "processing" | "error" | "idle";
  recordsProcessed: number;
  lastUpdated: string;
}

export interface PipelineStatus {
  stages: PipelineStage[];
  hourlyIngestion: number[];
  lastRunAt: string;
  isRunning: boolean;
}

export interface PipelineRun {
  runId: string;
  triggeredAt: string;
  studiesProcessed: number;
  durationSeconds: number;
  status: "completed" | "running" | "failed" | "pending";
  logs?: string;
}

export interface JobQueueItem {
  jobId: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: string;
  priority: number;
}

// ─── Response mappers ────────────────────────────────────────────────────────

function mapStudy(raw: any): Study {
  const entities: any[] = raw.entities ?? [];
  const relationships: any[] = raw.relationships ?? [];

  return {
    accession: raw.accession,
    title: raw.title,
    releaseDate: raw.releaseDate ?? raw.release_date ?? "",
    authorCount: raw.authors?.length ?? raw.authorCount ?? 0,
    confidenceScore: Math.round((raw.confidenceScore ?? raw.confidence_score ?? 0) * 100),
    entityCounts: raw.entityCounts ?? {
      proteins: entities.filter((e: any) => e.type === "protein").length,
      genes: entities.filter((e: any) => e.type === "gene").length,
      compounds: entities.filter((e: any) => e.type === "compound").length,
    },
    primaryTarget: raw.primaryTarget ?? raw.primary_target,
    abstract: raw.abstract,
    hypothesis: raw.hypothesis,
    entities: entities.map(mapEntity),
    relationships: relationships.map((r: any) => ({
      sourceEntity: r.sourceEntity ?? r.source_entity,
      targetEntity: r.targetEntity ?? r.target_entity,
      relationshipType: r.relationshipType ?? r.relationship_type,
      confidence: r.confidence ?? 0.5,
      evidenceSnippet: r.evidenceSnippet ?? r.evidence_snippet,
      sourceCount: r.sourceCount ?? r.source_count ?? 1,
    })),
    authors: raw.authors ?? [],
    links: raw.links ?? [],
    sourceUrl: raw.sourceUrl ?? raw.source_url,
    pmid: raw.pmid,
  };
}

function mapEntity(raw: any): Entity {
  return {
    id: raw.id,
    text: raw.text ?? raw.name ?? "",
    type: raw.type,
    confidence: raw.confidence,
    mentions: raw.mentions,
    source: raw.source,
    description: raw.description,
  };
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_STUDIES: Study[] = [
  {
    accession: "S-BSST1001",
    title:
      "Transcriptomic profiling of BRCA1 mutant breast cancer cells under hypoxic conditions reveals novel therapeutic targets",
    releaseDate: "2024-03-15",
    authorCount: 8,
    confidenceScore: 94,
    entityCounts: { proteins: 42, genes: 18, compounds: 7 },
    primaryTarget: "BRCA1",
    abstract:
      "We performed comprehensive RNA-seq analysis of BRCA1 mutant MCF-7 cells under normoxic and hypoxic conditions. HIF-1α and VEGF expression were significantly upregulated, while TP53 pathway genes showed suppression. Treatment with Olaparib (PARP inhibitor) demonstrated synergistic effects with Bevacizumab in reducing tumor viability.",
  },
  {
    accession: "S-BSST1002",
    title:
      "Single-cell RNA sequencing reveals heterogeneity in KRAS-driven pancreatic ductal adenocarcinoma",
    releaseDate: "2024-02-28",
    authorCount: 12,
    confidenceScore: 89,
    entityCounts: { proteins: 31, genes: 24, compounds: 3 },
    primaryTarget: "KRAS G12D",
    abstract:
      "scRNA-seq profiling of 4,200 cells from primary PDAC tumors identified six distinct cell populations. KRAS G12D mutation drives ERK/MAPK signaling hyperactivation. Gemcitabine resistance mechanisms correlate with elevated RRM1 and ENT1 expression in cancer stem cell subpopulations.",
  },
  {
    accession: "S-BSST1003",
    title:
      "Structural characterization of ACE2-Spike protein interactions and implications for therapeutic antibody design",
    releaseDate: "2024-01-20",
    authorCount: 6,
    confidenceScore: 96,
    entityCounts: { proteins: 58, genes: 12, compounds: 15 },
    primaryTarget: "ACE2",
    abstract:
      "Cryo-EM structures of ACE2 in complex with SARS-CoV-2 Spike RBD variants resolved at 2.8Å. Key contact residues K417, E484, and N501 modulate binding affinity. Neutralizing antibodies targeting the receptor binding motif show broad cross-reactivity against Omicron sub-variants.",
  },
  {
    accession: "S-BSST1004",
    title:
      "Epigenome-wide association study identifies novel CpG methylation patterns in Alzheimer's disease progression",
    releaseDate: "2024-01-08",
    authorCount: 15,
    confidenceScore: 82,
    entityCounts: { proteins: 23, genes: 31, compounds: 2 },
    primaryTarget: "APOE ε4",
    abstract:
      "EWAS analysis of 850K CpG sites in 312 post-mortem brain samples identified 847 differentially methylated positions. APOE ε4 carriers show distinct methylation signatures at ANK1, CDH23, and BIN1 loci. Tau phosphorylation at T181 correlates with CpG hypomethylation in hippocampal neurons.",
  },
  {
    accession: "S-BSST1005",
    title:
      "Proteomics-driven discovery of biomarkers for early-stage non-small cell lung cancer via liquid biopsy",
    releaseDate: "2023-12-14",
    authorCount: 9,
    confidenceScore: 91,
    entityCounts: { proteins: 67, genes: 8, compounds: 4 },
    primaryTarget: "EGFR",
    abstract:
      "Plasma proteomics using TMT-based mass spectrometry identified 12 candidate biomarkers for stage I NSCLC. CEA, CYFRA 21-1, and ProGRP in combination achieved 88% sensitivity at 95% specificity. EGFR exon 19 deletion status modulates circulating protein profiles detectable pre-symptomatically.",
  },
  {
    accession: "S-BSST1006",
    title:
      "CRISPR-Cas9 genome-wide screen identifies synthetic lethal interactions in PTEN-null glioblastoma",
    releaseDate: "2023-11-30",
    authorCount: 11,
    confidenceScore: 87,
    entityCounts: { proteins: 19, genes: 44, compounds: 9 },
    primaryTarget: "PTEN / AKT1",
    abstract:
      "Pooled CRISPR screen of 18,010 genes in PTEN-null U87MG cells revealed 94 essential synthetic lethal partners. PI3K/mTOR pathway genes AKT1, MTOR, and PIK3CA ranked as top hits. Temozolomide resistance can be reversed by WEE1 kinase inhibition through CDC25C checkpoint modulation.",
  },
];

const MOCK_RAW_TEXT = `We performed transcriptomic analysis of BRCA1 mutant MCF-7 cells subjected to hypoxic stress (1% O2 for 24h). RNA was extracted and subjected to Illumina NovaSeq 6000 sequencing at 30M reads depth.

HIF-1α (hypoxia-inducible factor) protein levels were elevated 4.2-fold under hypoxic conditions, with concomitant upregulation of its canonical targets VEGF, LDHA, and PDK1. The TP53 tumor suppressor showed reduced activity, evidenced by decreased p21 and MDM2 transcript levels.

Treatment with Olaparib (AZD2281), a PARP inhibitor, combined with Bevacizumab (anti-VEGF monoclonal antibody) demonstrated synergistic cytotoxicity in BRCA1-mutant cells (CI = 0.34). The PARP1 enzyme showed complete inhibition at 100nM Olaparib concentration.

Cell viability assays confirmed that Cisplatin resistance in BRCA1-deficient cells correlates with elevated RAD51 recombinase expression and MRE11-RAD50-NBS1 complex activity. These findings suggest that targeting the DNA damage response pathway in combination with anti-angiogenic therapy represents a promising therapeutic strategy for triple-negative breast cancer.`;

const MOCK_ENTITIES: Entity[] = [
  { id: "e1", text: "BRCA1", type: "gene", confidence: 0.99, mentions: 4, source: "NCBI Gene", description: "Breast cancer type 1 susceptibility protein. Tumor suppressor involved in DNA repair." },
  { id: "e2", text: "HIF-1α", type: "protein", confidence: 0.97, mentions: 3, source: "UniProt Q16665", description: "Hypoxia-inducible factor 1-alpha. Master regulator of cellular response to hypoxia." },
  { id: "e3", text: "VEGF", type: "protein", confidence: 0.96, mentions: 3, source: "UniProt P15692", description: "Vascular endothelial growth factor A. Key angiogenesis promoter." },
  { id: "e4", text: "TP53", type: "gene", confidence: 0.98, mentions: 2, source: "NCBI Gene", description: "Tumor protein p53. Guardian of the genome — key tumor suppressor." },
  { id: "e5", text: "Olaparib", type: "compound", confidence: 0.99, mentions: 2, source: "ChEMBL CHEMBL521686", description: "PARP inhibitor. FDA-approved for BRCA-mutated ovarian and breast cancer." },
  { id: "e6", text: "Bevacizumab", type: "compound", confidence: 0.98, mentions: 2, source: "DrugBank DB00112", description: "Anti-VEGF monoclonal antibody. Inhibits angiogenesis in multiple cancer types." },
  { id: "e7", text: "PARP1", type: "protein", confidence: 0.95, mentions: 2, source: "UniProt P09874", description: "Poly [ADP-ribose] polymerase 1. Key DNA repair enzyme and oncology drug target." },
  { id: "e8", text: "Cisplatin", type: "compound", confidence: 0.99, mentions: 1, source: "DrugBank DB00515", description: "Platinum-based chemotherapeutic agent causing DNA cross-linking." },
  { id: "e9", text: "RAD51", type: "protein", confidence: 0.94, mentions: 2, source: "UniProt Q06609", description: "DNA repair protein RAD51 homolog 1. Central mediator of homologous recombination." },
  { id: "e10", text: "triple-negative breast cancer", type: "disease", confidence: 0.97, mentions: 1, source: "MONDO:0005494", description: "Breast cancer subtype lacking ER, PR, and HER2 expression. Poor prognosis subtype." },
  { id: "e11", text: "LDHA", type: "gene", confidence: 0.92, mentions: 1, source: "NCBI Gene", description: "Lactate dehydrogenase A. Key glycolytic enzyme upregulated in Warburg metabolism." },
  { id: "e12", text: "PDK1", type: "protein", confidence: 0.91, mentions: 1, source: "UniProt Q15118", description: "Pyruvate dehydrogenase kinase 1. Redirects glucose metabolism under hypoxia." },
];

const MOCK_PIPELINE_STATUS: PipelineStatus = {
  stages: [
    { id: "ingest", label: "Ingest", source: "BioStudies API", status: "active", recordsProcessed: 2847, lastUpdated: new Date(Date.now() - 120000).toISOString() },
    { id: "store", label: "Store", source: "S3 Mock", status: "active", recordsProcessed: 2841, lastUpdated: new Date(Date.now() - 180000).toISOString() },
    { id: "process", label: "Process", source: "Lambda/Bedrock", status: "processing", recordsProcessed: 2819, lastUpdated: new Date(Date.now() - 60000).toISOString() },
    { id: "index", label: "Index", source: "VectorDB", status: "active", recordsProcessed: 2803, lastUpdated: new Date(Date.now() - 240000).toISOString() },
  ],
  hourlyIngestion: [48, 72, 91, 65, 83, 110, 95, 78, 102, 88, 115, 97],
  lastRunAt: new Date(Date.now() - 3600000).toISOString(),
  isRunning: true,
};

const MOCK_PIPELINE_RUNS: PipelineRun[] = [
  { runId: "run-20240315-001", triggeredAt: new Date(Date.now() - 3600000).toISOString(), studiesProcessed: 145, durationSeconds: 287, status: "completed", logs: "INFO: Ingested 145 studies from BioStudies API\nINFO: All entities extracted successfully\nINFO: Vector index updated" },
  { runId: "run-20240315-002", triggeredAt: new Date(Date.now() - 7200000).toISOString(), studiesProcessed: 98, durationSeconds: 195, status: "completed", logs: "INFO: Ingested 98 studies\nINFO: 3 studies skipped (duplicate accession)" },
  { runId: "run-20240315-003", triggeredAt: new Date(Date.now() - 14400000).toISOString(), studiesProcessed: 0, durationSeconds: 12, status: "failed", logs: "ERROR: BioStudies API returned 503 Service Unavailable\nERROR: Retried 3 times, aborting run" },
  { runId: "run-20240315-004", triggeredAt: new Date(Date.now() - 21600000).toISOString(), studiesProcessed: 203, durationSeconds: 412, status: "completed", logs: "INFO: Ingested 203 studies\nINFO: Entity extraction completed" },
  { runId: "run-20240315-005", triggeredAt: new Date(Date.now() - 43200000).toISOString(), studiesProcessed: 178, durationSeconds: 356, status: "completed" },
  { runId: "run-20240315-006", triggeredAt: new Date(Date.now() - 86400000).toISOString(), studiesProcessed: 312, durationSeconds: 628, status: "completed" },
];

const MOCK_JOB_QUEUE: JobQueueItem[] = [
  { jobId: "job-001", type: "INGEST", status: "running", createdAt: new Date(Date.now() - 120000).toISOString(), priority: 1 },
  { jobId: "job-002", type: "NER_EXTRACT", status: "running", createdAt: new Date(Date.now() - 90000).toISOString(), priority: 2 },
  { jobId: "job-003", type: "VECTOR_INDEX", status: "pending", createdAt: new Date(Date.now() - 60000).toISOString(), priority: 3 },
  { jobId: "job-004", type: "INGEST", status: "pending", createdAt: new Date(Date.now() - 30000).toISOString(), priority: 4 },
  { jobId: "job-005", type: "REPORT", status: "completed", createdAt: new Date(Date.now() - 300000).toISOString(), priority: 5 },
];

// ─── API client ───────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost:8000";

async function safeFetch<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export async function fetchStudies(): Promise<Study[]> {
  const data = await safeFetch<any[]>(`${BASE_URL}/api/studies`);
  if (data) return data.map(mapStudy);
  return MOCK_STUDIES;
}

export async function fetchStudy(accession: string): Promise<Study | null> {
  const data = await safeFetch<any>(`${BASE_URL}/api/study/${accession}`);
  if (data) return mapStudy(data);
  return MOCK_STUDIES.find((s) => s.accession === accession) ?? MOCK_STUDIES[0];
}

export async function fetchEntities(accession: string): Promise<StudyWithEntities> {
  const data = await safeFetch<any>(`${BASE_URL}/api/study/${accession}/entities`);
  if (data) {
    return {
      ...mapStudy(data),
      rawText: data.rawText ?? "",
      entities: (data.entities ?? []).map(mapEntity),
    };
  }

  const study = MOCK_STUDIES.find((s) => s.accession === accession) ?? MOCK_STUDIES[0];
  return {
    ...study,
    rawText: MOCK_RAW_TEXT,
    entities: MOCK_ENTITIES,
  };
}

export async function fetchPipelineStatus(): Promise<PipelineStatus> {
  const data = await safeFetch<PipelineStatus>(`${BASE_URL}/api/pipeline/status`);
  return data ?? MOCK_PIPELINE_STATUS;
}

export async function fetchPipelineRuns(): Promise<PipelineRun[]> {
  const data = await safeFetch<PipelineRun[]>(`${BASE_URL}/api/pipeline/runs`);
  return data ?? MOCK_PIPELINE_RUNS;
}

export async function fetchJobQueue(): Promise<JobQueueItem[]> {
  const data = await safeFetch<JobQueueItem[]>(`${BASE_URL}/api/pipeline/jobs`);
  return data ?? MOCK_JOB_QUEUE;
}

export interface DashboardMetrics {
  studies_indexed: number;
  entities_extracted: number;
  pipeline_uptime: number;
  avg_confidence: number;
}

export interface TrendingEntity {
  name: string;
  type: "protein" | "gene" | "compound" | "disease" | "pathway";
  count: number;
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics | null> {
  return safeFetch<DashboardMetrics>(`${BASE_URL}/api/dashboard/metrics`);
}

export async function fetchTrendingEntities(): Promise<TrendingEntity[]> {
  const data = await safeFetch<TrendingEntity[]>(`${BASE_URL}/api/dashboard/trending`);
  return data ?? [];
}

export async function runIngestion(): Promise<{ success: boolean; message: string; runId?: string }> {
  const data = await safeFetch<any>(`${BASE_URL}/api/pipeline/run`, { method: "POST" });
  if (data) {
    return {
      success: data.status !== "failed",
      message: data.logs ?? "Ingestion pipeline triggered",
      runId: data.runId,
    };
  }
  return {
    success: true,
    message: "Ingestion pipeline triggered successfully",
    runId: `run-${Date.now()}`,
  };
}

export { MOCK_PIPELINE_RUNS, MOCK_JOB_QUEUE };

// ─── Virtual Lab types ────────────────────────────────────────────────────────

export interface ResidueScore {
  residue_index: number;
  residue_name: string;
  plddt_score: number;
}

export interface InterfaceResidue {
  residue_index: number;
  residue_name: string;
  interaction_type: "hydrogen_bond" | "salt_bridge" | "hydrophobic" | "van_der_waals";
  partner_residue: string;
}

export interface HydrogenBond {
  donor: string;
  acceptor: string;
  estimated_distance_angstrom: number;
}

export interface BindingInterface {
  protein_a: string;
  protein_b: string;
  interface_residues_a: InterfaceResidue[];
  interface_residues_b: InterfaceResidue[];
  hydrogen_bonds: HydrogenBond[];
  interface_area_sq_angstrom: number;
  binding_type: string;
  confidence: number;
  description: string;
}

export interface LeadCompound {
  name: string;
  chembl_id: string;
  smiles: string;
  molecular_weight: number | null;
  logp: number | null;
  molecular_formula: string;
  scaffold_description: string;
  target_protein: string;
  bioactivities: Array<{
    type: string;
    value: number | null;
    units: string;
    target: string;
    pchembl: number | null;
  }>;
}

export interface AlphaFoldResult {
  protein_name: string;
  uniprot_name: string;
  accession: string;
  gene: string;
  mean_confidence: number;
  confidence_tier: "high" | "medium" | "low";
  pdb_url: string;
  entry_id: string;
  alphafold_url: string;
  per_residue_plddt?: ResidueScore[];
}

export interface DockingResult {
  compound: string;
  target: string;
  status: "predicted" | "no_data" | "error";
  smiles?: string;
  molecular_weight?: number;
  xlogp?: number;
  overall_score: number;
  tier: "favorable" | "moderate" | "unfavorable";
  interpretation?: string;
  component_scores?: {
    lipinski_compliance: number;
    veber_bioavailability: number;
    mw_complementarity: number;
  };
}

export interface ValidationPlan {
  validation_plans: Array<{
    hypothesis_index: number;
    experiment_name: string;
    assay_type: string;
    model_system: string;
    controls: { positive: string; negative: string };
    readout: string;
    expected_outcome: string;
    feasibility: "high" | "medium" | "low";
    estimated_timeline: string;
    key_reagents: string[];
  }>;
  docking_recommendations: Array<{ compound: string; target: string; rationale: string }>;
  overall_feasibility: string;
}

export interface GraphInsights {
  summary?: string;
  contradictions_interpretation?: string[];
  research_opportunities?: Array<{ entity: string; reason: string; suggested_experiment: string }>;
  network_insights?: string[];
}

export interface KGSubgraph {
  node_count: number;
  edge_count: number;
  elements: {
    nodes: Array<{ data: { id: string; label: string; entity_type: string; source_count: number; subtype?: string } }>;
    edges: Array<{ data: { id: string; source: string; target: string; relationship: string; confidence: number; kd_value?: number } }>;
  };
}

export interface BindingEnergyMatrix {
  rows: string[];
  cols: string[];
  values: number[][];
  unit: string;
}

export interface AgentMessage {
  id: string;
  agent_name: string;
  agent_role: "orchestrator" | "specialist" | "critic" | "analyst" | "experimentalist";
  agent_color: string;
  content: string;
  timestamp: string;
  message_type: "message" | "tool_call" | "tool_result" | "final" | "error";
  tool_data?: AlphaFoldResult | DockingResult | null;
}

export interface LabEntity {
  name: string;
  type: "protein" | "gene" | "compound" | "disease" | "pathway";
  priority: "high" | "medium" | "low";
}

export interface LabSession {
  session_id: string;
  query: string;
  status: "pending" | "running" | "completed" | "failed";
  messages: AgentMessage[];
  entities_found: LabEntity[];
  alphafold_results: AlphaFoldResult[];
  binding_interface?: BindingInterface;
  per_residue_plddt?: Record<string, ResidueScore[]>;
  lead_compounds?: LeadCompound[];
  binding_energy_matrix?: BindingEnergyMatrix;
  graph_insights: GraphInsights;
  hypotheses: string[];
  critique: string;
  docking_results: DockingResult[];
  validation_plan: ValidationPlan;
  final_summary: string;
  created_at: string;
  completed_at?: string | null;
}

// ─── Virtual Lab API ──────────────────────────────────────────────────────────

export async function startLabSession(query: string): Promise<{ session_id: string } | null> {
  return safeFetch<{ session_id: string }>(`${BASE_URL}/api/lab/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
}

export async function fetchLabSession(sessionId: string): Promise<LabSession | null> {
  return safeFetch<LabSession>(`${BASE_URL}/api/lab/session/${sessionId}`);
}

export async function fetchLabSessions(): Promise<LabSession[]> {
  const data = await safeFetch<LabSession[]>(`${BASE_URL}/api/lab/sessions`);
  return data ?? [];
}

/**
 * Subscribe to SSE stream for a lab session.
 * Returns a cleanup function to close the connection.
 */
export function streamLabSession(
  sessionId: string,
  callbacks: {
    onMessage: (msg: AgentMessage) => void;
    onStatus: (data: {
      status: LabSession["status"];
      entities_found: LabEntity[];
      alphafold_results: AlphaFoldResult[];
      per_residue_plddt?: Record<string, ResidueScore[]>;
      binding_interface?: BindingInterface;
      binding_energy_matrix?: BindingEnergyMatrix;
      lead_compounds?: LeadCompound[];
      graph_insights: GraphInsights;
      hypotheses: string[];
      critique: string;
      docking_results: DockingResult[];
      validation_plan: ValidationPlan;
      final_summary: string;
    }) => void;
    onDone: (session: LabSession) => void;
    onError: () => void;
  },
): () => void {
  const url = `${BASE_URL}/api/lab/session/${sessionId}/stream`;
  const es = new EventSource(url);

  es.addEventListener("message", (e) => {
    try {
      callbacks.onMessage(JSON.parse(e.data));
    } catch {}
  });

  es.addEventListener("status", (e) => {
    try {
      callbacks.onStatus(JSON.parse(e.data));
    } catch {}
  });

  es.addEventListener("done", (e) => {
    try {
      callbacks.onDone(JSON.parse(e.data));
    } catch {}
    es.close();
  });

  es.onerror = () => {
    callbacks.onError();
    es.close();
  };

  return () => es.close();
}

// ─── Knowledge Graph API ────────────────────────────────────────────────────

export async function fetchKGSubgraph(nodes: string = "", depth: number = 1): Promise<KGSubgraph | null> {
  const params = new URLSearchParams();
  if (nodes) params.set("nodes", nodes);
  params.set("depth", String(depth));
  return safeFetch<KGSubgraph>(`${BASE_URL}/api/knowledge-graph/subgraph?${params}`);
}

export async function fetchKGStats(): Promise<{ node_count: number; edge_count: number; entity_types: Record<string, number> } | null> {
  return safeFetch<any>(`${BASE_URL}/api/knowledge-graph/stats`);
}

export async function fetchPPINetwork(nodes: string = "", depth: number = 1): Promise<KGSubgraph | null> {
  const params = new URLSearchParams();
  if (nodes) params.set("nodes", nodes);
  params.set("depth", String(depth));
  return safeFetch<KGSubgraph>(`${BASE_URL}/api/knowledge-graph/ppi-network?${params}`);
}

// ─── Docking API ────────────────────────────────────────────────────────────

export async function fetchDockingPrediction(compound: string, target: string): Promise<DockingResult | null> {
  return safeFetch<DockingResult>(`${BASE_URL}/api/docking/predict?compound=${encodeURIComponent(compound)}&target=${encodeURIComponent(target)}`);
}
