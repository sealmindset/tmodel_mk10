# Redis Key Pattern & Usage Inventory

| Redis Key Pattern                                  | Data Type      | Used In (File/Function)                             | Notes/Context                                            |
|----------------------------------------------------|----------------|-----------------------------------------------------|----------------------------------------------------------|
| subject:{id}:title                                 | string         | threatModelService.js, threatModelMergeService.js, threatModelMergeServiceV2.js | Threat model metadata (title)                            |
| subject:{id}:response                              | string         | threatModelService.js, threatModelMergeService.js, threatModelMergeServiceV2.js | Threat model response text                               |
| subject:{id}:model                                 | string         | threatModelService.js                               | Model type/name                                          |
| subject:{id}:text                                  | string         | threatModelService.js                               | Subject text                                             |
| subject:{id}:threatCount                           | int/string     | threatModelService.js, threatModelMergeService.js    | Number of threats in model                               |
| subject:{id}:mergeMetadata                         | JSON           | threatModelMergeService.js                          | Merge metadata for threat models                         |
| subject:*:response                                 | pattern        | threatModelService.js                               | List all models                                          |
| project:{projectId}:threat_models*                 | pattern        | projectAssignmentService.js                         | Threat models assigned to a project (cache)              |
| project:{projectId}:total_threat_model_count       | string/int     | projectAssignmentService.js                         | Cached count for project                                 |
| project:{projectId}:subject:{sid}                  | hash           | projectAssignmentService.js                         | Assignment metadata (e.g., assigned_at)                  |
| project:{projectId}:subjects                       | set            | projectAssignmentService.js                         | All subject IDs assigned to a project                    |
| CAT_CACHE_KEY (refarch:categories)                 | stringified JSON| referenceArchitectureService.js                    | Cached categories                                        |
| option:{categoryId} (refarch:options:{id})         | stringified JSON| referenceArchitectureService.js                    | Cached options for category                              |
| settings:rapid7:api_url                            | string         | fix-rapid7-settings.js, verify-rapid7-connection.js | Rapid7 API URL                                           |
| settings:rapid7:api_key                            | string         | fix-rapid7-settings.js, verify-rapid7-connection.js | Rapid7 API key                                           |
| *rapid7*                                           | pattern        | fix-rapid7-settings.js                              | Wildcard for all Rapid7 settings                         |
| settings:openai:api_model                          | string         | llmAnalysisService.js                               | OpenAI model setting                                     |
| settings:ollama:model                              | string         | llmAnalysisService.js                               | Ollama model setting                                     |