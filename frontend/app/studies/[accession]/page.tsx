"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Users, FileText } from "lucide-react";
import Link from "next/link";
import SourceLink from "@/components/SourceLink";
import RelationshipTable from "@/components/RelationshipTable";
import EntityDistribution from "@/components/EntityDistribution";
import SimilarStudies from "@/components/SimilarStudies";
import { fetchStudy, type Study } from "@/lib/api";

interface PageProps {
  params: {
    accession: string;
  };
}

export default function StudyDetailsPage({ params }: PageProps) {
  const [study, setStudy] = useState<Study | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStudy = async () => {
      try {
        setLoading(true);
        const data = await fetchStudy(params.accession);
        setStudy(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load study");
      } finally {
        setLoading(false);
      }
    };

    loadStudy();
  }, [params.accession]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading study details...</p>
        </div>
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <Link href="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800">{error || "Study not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{study.title}</h1>
            <p className="text-slate-600 flex items-center gap-4 flex-wrap">
              <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">
                {study.accession}
              </span>
              {study.releaseDate && (
                <span className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4" />
                  {new Date(study.releaseDate).toLocaleDateString()}
                </span>
              )}
              {study.authors && study.authors.length > 0 && (
                <span className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4" />
                  {study.authors.length} author{study.authors.length !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 space-y-8"
          >
            {/* Source Link */}
            <SourceLink
              accession={study.accession}
              pmid={study.pmid}
              sourceUrl={study.sourceUrl}
            />

            {/* Abstract */}
            {study.abstract && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-6 rounded-lg border border-slate-200"
              >
                <div className="flex items-start gap-3 mb-4">
                  <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-slate-900">Abstract</h3>
                    <p className="text-xs text-slate-500">Original study summary</p>
                  </div>
                </div>
                <p className="text-slate-700 leading-relaxed text-sm">{study.abstract}</p>
              </motion.div>
            )}

            {/* Entity Distribution */}
            {study.entities && study.entities.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <EntityDistribution entities={study.entities} />
              </motion.div>
            )}

            {/* Relationships */}
            {study.relationships && study.relationships.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <RelationshipTable relationships={study.relationships} />
              </motion.div>
            )}

            {/* Hypothesis and primary target */}
            {(study.hypothesis || study.primaryTarget) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-lg border border-indigo-200"
              >
                <h3 className="font-semibold text-slate-900 mb-3">Key Findings</h3>
                {study.primaryTarget && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">
                      Primary Target
                    </p>
                    <p className="text-lg font-semibold text-indigo-900">{study.primaryTarget}</p>
                  </div>
                )}
                {study.hypothesis && (
                  <div>
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">
                      Research Hypothesis
                    </p>
                    <p className="text-slate-900">{study.hypothesis}</p>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Study stats */}
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Study Overview</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">
                    Entities Extracted
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {study.entities?.length || 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">
                    Relationships Found
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {study.relationships?.length || 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">
                    Confidence Score
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
                        style={{ width: `${(study.confidenceScore || 0) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-900">
                      {Math.round((study.confidenceScore || 0) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Similar studies */}
            {study.entities && study.entities.length > 0 && (
              <SimilarStudies
                currentAccession={study.accession}
                currentEntities={study.entities}
              />
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
