"use client";

import { ExternalLink } from "lucide-react";

interface SourceLinkProps {
  accession: string;
  pmid?: string;
  sourceUrl?: string;
}

export default function SourceLink({ accession, pmid, sourceUrl }: SourceLinkProps) {
  // Construct URLs
  const ebiUrl = sourceUrl || `https://www.ebi.ac.uk/biostudies/studies/${accession}`;
  const pubmedUrl = pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : null;

  return (
    <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
      <div>
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
          View Original Study
        </p>
        <div className="flex flex-wrap gap-2">
          {/* EBI BioStudies Link */}
          <a
            href={ebiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-blue-200 rounded-md hover:bg-blue-50 transition-colors text-sm font-medium text-blue-700"
          >
            <span>EBI BioStudies</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* PubMed Link (if available) */}
          {pubmedUrl && (
            <a
              href={pubmedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-emerald-200 rounded-md hover:bg-emerald-50 transition-colors text-sm font-medium text-emerald-700"
            >
              <span>PubMed</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
