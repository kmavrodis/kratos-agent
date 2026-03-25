---
name: rag-search
description: Azure AI Search knowledge base
enabled: true
index_name: knowledge-base
---

# RAG Search Skill

**IMPORTANT**: Always pass `index_name: "knowledge-base"` when calling `rag_search`. This is the dedicated search index for the generic knowledge base.