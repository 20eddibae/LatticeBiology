"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ExternalLink, Zap } from "lucide-react";

interface Study {
  accession: string;
  title: string;
  entities: Array<{ text: string; type: string }>;
  confidenceScore?: number;
}

interface SimilarStudiesProps {
  currentAccession: string;
  currentEntities: Array<{ text: string; type: string }>;
}

export default function SimilarStudies({
  currentAccession,
  currentEntities,
}: SimilarStudiesProps) {
  const [similarStudies, setSimilarStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSimilarStudies = async () => {
      try {
        // Get all studies
        const res = await fetch("/api/studies");
        const studies: Study[] = await res.json();

        // Calculate similarity for each study
        const currentEntitySet = new Set(currentEntities.map((e) => e.text.toLowerCase()));

        const similarities = studies
          .filter((s) => s.accession !== currentAccession)
          .map((study) => {
            const studyEntitySet = new Set(study.entities.map((e) => e.text.toLowerCase()));
            const intersection = new Set(
              Array.from(currentEntitySet).filter((e) => studyEntitySet.has(e))
            );
            const similarity = intersection.size / Math.max(currentEntitySet.size, 1);
            return { study, similarity, sharedEntities: Array.from(intersection) };
          })
          .filter((item) => item.similarity > 0.3)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5);

        setSimilarStudies(
          similarities.map((item) => ({
            ...item.study,
            similarity: item.similarity,
            sharedEntities: item.sharedEntities,
          }))
        );
      } catch (error) {
        console.error("Error fetching similar studies:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSimilarStudies();
  }, [currentAccession, currentEntities]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <p className="text-slate-500">Finding similar studies...</p>
      </div>
    );
  }

  if (similarStudies.length === 0) {
    return (
      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 text-center">
        <p className="text-slate-500 text-sm">No similar studies found in the database.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-lg border border-slate-200"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Related Studies</h3>
        <p className="text-sm text-slate-500">
          {similarStudies.length} other studies share similar entities
        </p>
      </div>

      <div className="space-y-3">
        {similarStudies.map((study: any, idx) => (
          <motion.div
            key={study.accession}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all group"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <Link
                href={`/studies/${study.accession}`}
                className="flex-1 min-w-0 group-hover:text-blue-700 transition-colors"
              >
                <p className="font-medium text-slate-900 truncate group-hover:underline">
                  {study.title}
                </p>
                <p className="text-xs text-slate-500">{study.accession}</p>
              </Link>
              {study.similarity && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 rounded text-xs font-semibold text-blue-900 whitespace-nowrap">
                  <Zap className="w-3 h-3" />
                  {Math.round(study.similarity * 100)}% match
                </div>
              )}
            </div>

            {study.sharedEntities && study.sharedEntities.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-medium text-slate-600 mb-1">Shared entities:</p>
                <div className="flex flex-wrap gap-1">
                  {study.sharedEntities.slice(0, 3).map((entity: string) => (
                    <span
                      key={entity}
                      className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded"
                    >
                      {entity}
                    </span>
                  ))}
                  {study.sharedEntities.length > 3 && (
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                      +{study.sharedEntities.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            <Link
              href={`/studies/${study.accession}`}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View study <ExternalLink className="w-3 h-3" />
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
