"""
MCP Server for LatticeBio — exposes BioStudies, AlphaFold, and PubChem
as standardized Model Context Protocol tools.

Run standalone:
    python mcp_server.py

Or integrate with an MCP client via stdio transport.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from typing import Any

# Ensure imports work when run from backend/
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
import pathlib
load_dotenv(pathlib.Path(__file__).resolve().parent.parent / ".env")
load_dotenv()

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("mcp_server")

# ---------------------------------------------------------------------------
# Create MCP server
# ---------------------------------------------------------------------------

server = Server("latticebio")


# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------

@server.list_tools()
async def list_tools() -> list[Tool]:
    """Expose available biological research tools."""
    return [
        Tool(
            name="search_biostudies",
            description=(
                "Search the EBI BioStudies database for biological studies. "
                "Returns study accessions, titles, and abstracts matching the query. "
                "Use this to find relevant research data for a given topic."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query (e.g., 'BRCA1 breast cancer', 'KRAS pancreatic')",
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of results to return (default: 5, max: 20)",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="fetch_study_detail",
            description=(
                "Fetch detailed metadata for a specific BioStudies accession. "
                "Returns title, abstract, authors, links, and release date. "
                "Use this after search_biostudies to get full details on a specific study."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "accession": {
                        "type": "string",
                        "description": "BioStudies accession ID (e.g., 'S-EPMC10139049')",
                    },
                },
                "required": ["accession"],
            },
        ),
        Tool(
            name="lookup_protein_structure",
            description=(
                "Look up a protein's 3D structure prediction from AlphaFold DB via UniProt. "
                "Returns the UniProt accession, mean pLDDT confidence score, PDB file URL, "
                "and a link to the AlphaFold DB entry. Use this to get structural data "
                "for a protein or gene name."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "protein_name": {
                        "type": "string",
                        "description": "Protein or gene name (e.g., 'BRCA1', 'p53', 'ACE2')",
                    },
                },
                "required": ["protein_name"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    """Handle tool invocations."""

    if name == "search_biostudies":
        from biostudies import search_studies

        query = arguments["query"]
        max_results = min(arguments.get("max_results", 5), 20)

        results = await search_studies(query=query, page_size=max_results)

        if not results:
            return [TextContent(
                type="text",
                text=json.dumps({"status": "no_results", "query": query, "studies": []}, indent=2),
            )]

        studies = []
        for r in results:
            studies.append({
                "accession": r.get("accession", ""),
                "title": r.get("title", ""),
                "abstract": (r.get("abstract") or r.get("content", ""))[:300],
                "release_date": r.get("release_date", ""),
                "author_count": len(r.get("author", [])),
            })

        return [TextContent(
            type="text",
            text=json.dumps({
                "status": "success",
                "query": query,
                "result_count": len(studies),
                "studies": studies,
            }, indent=2),
        )]

    elif name == "fetch_study_detail":
        from biostudies import fetch_study

        accession = arguments["accession"]
        detail = await fetch_study(accession)

        return [TextContent(
            type="text",
            text=json.dumps({
                "status": "success",
                "accession": detail.get("accession", accession),
                "title": detail.get("title", ""),
                "abstract": detail.get("abstract", ""),
                "release_date": detail.get("release_date", ""),
                "authors": [a.get("name", "") for a in detail.get("author", [])],
                "links": [{"url": l.get("url", ""), "type": l.get("type", "")} for l in detail.get("links", [])],
            }, indent=2),
        )]

    elif name == "lookup_protein_structure":
        from agents.tools import lookup_alphafold

        protein_name = arguments["protein_name"]
        result = await lookup_alphafold(protein_name)

        if result is None:
            return [TextContent(
                type="text",
                text=json.dumps({
                    "status": "not_found",
                    "protein_name": protein_name,
                    "message": f"No AlphaFold structure found for '{protein_name}' in reviewed human proteome.",
                }, indent=2),
            )]

        return [TextContent(
            type="text",
            text=json.dumps({
                "status": "success",
                **result,
            }, indent=2),
        )]

    else:
        return [TextContent(
            type="text",
            text=json.dumps({"status": "error", "message": f"Unknown tool: {name}"}),
        )]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main():
    """Run the MCP server over stdio."""
    logger.info("Starting LatticeBio MCP server...")
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
