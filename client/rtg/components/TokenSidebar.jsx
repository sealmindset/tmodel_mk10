import React from 'react';

const GROUPS = [
  {
    title: 'Global Tokens',
    items: [
      'GENERATED_AT', 'AUTHOR', 'ENV', 'CI_EXAMPLE', 'PROJECT_KEY', 'RESILIENCY_TARGET',
      'PROJECTS_JSON', 'PROJECT_JSON', 'PROJECTS_COUNT', 'PROJECT_NAMES_CSV',
      'COMPONENTS_JSON', 'COMPONENTS_COUNT', 'THREATS_JSON', 'VULNERABILITIES_JSON', 'THREAT_SAFEGUARDS_JSON',
      'STATISTICS_JSON', 'PIPELINE_STEPS_JSON', 'TERRAFORM_TAGS_JSON', 'AWS_ACCOUNTS_JSON'
    ]
  },
  {
    title: 'Report Macros',
    items: [
      'PROJECT_DATA_JSON', 'PROJECT_TABLE', 'COMPONENT_DATA_JSON', 'COMPONENT_TABLE',
      'SAFEGUARD_DATA_JSON', 'SAFEGUARD_TABLE', 'THREAT_MODEL_DATA_JSON', 'STATUS_SUMMARY', 'THREAT_MODEL_TABLE', 'RECENT_ACTIVITY_TABLE'
    ]
  },
  {
    title: 'Severity Badge',
    items: ['SEVERITY_BADGE:Critical', 'SEVERITY_BADGE:High', 'SEVERITY_BADGE:Medium', 'SEVERITY_BADGE:Low']
  }
];

export default function TokenSidebar() {
  const copy = async (raw) => {
    const token = raw.startsWith('SEVERITY_BADGE') ? `{{${raw}}}` : `{{${raw}}}`;
    try {
      await navigator.clipboard.writeText(token);
    } catch (_) {}
  };

  return (
    <div className="card">
      <div className="card-header">Tokens</div>
      <div className="card-body rtg-tokens">
        {GROUPS.map(group => (
          <div key={group.title} className="mb-3">
            <div className="fw-semibold mb-1">{group.title}</div>
            <div className="d-flex flex-wrap gap-1">
              {group.items.map(it => (
                <button key={it} className="btn btn-sm btn-outline-dark" onClick={() => copy(it)} title="Copy token">
                  {`{{${it}}}`}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="small text-muted">Click a token to copy. Paste into the editor.</div>
      </div>
    </div>
  );
}
