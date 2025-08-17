// utils/subjectProfiler.js
// Simple heuristic subject profiler to derive applicability tags.
// Returns { environment:[], platform:[], modality:[], data_sensitivity:[] }

const logger = require('./logger').forModule('subjectProfiler');

const KEYWORDS = {
  environment: [
    { k: ['cloud', 'azure', 'aws', 'gcp', 'saas', 'managed'], v: 'cloud' },
    { k: ['on-prem', 'onprem', 'on premises', 'self-host', 'self hosted', 'bare metal'], v: 'on-prem' },
    { k: ['pc', 'desktop', 'windows', 'mac', 'linux laptop'], v: 'pc' },
    { k: ['edge', 'iot', 'raspberry pi'], v: 'edge' },
    { k: ['mobile', 'ios', 'android'], v: 'mobile' }
  ],
  platform: [
    { k: ['ollama'], v: 'ollama' },
    { k: ['openai', 'gpt'], v: 'openai' },
    { k: ['azure'], v: 'azure' },
    { k: ['aws', 'bedrock'], v: 'aws' },
    { k: ['gcp', 'vertex'], v: 'gcp' },
    { k: ['local', 'localhost'], v: 'local' }
  ],
  modality: [
    { k: ['api', 'rest', 'http'], v: 'api' },
    { k: ['cli', 'command line'], v: 'cli' },
    { k: ['web', 'browser', 'ui'], v: 'web' },
    { k: ['service', 'daemon'], v: 'service' },
    { k: ['batch', 'offline'], v: 'batch' }
  ],
  data_sensitivity: [
    { k: ['pii', 'hipaa', 'phi', 'pci', 'sox', 'gdpr', 'restricted'], v: 'regulated' },
    { k: ['confidential', 'secret', 'sensitive'], v: 'confidential' },
    { k: ['internal', 'internal only'], v: 'internal' },
    { k: ['public'], v: 'public' }
  ]
};

function normalize(text) {
  return (text || '').toString().toLowerCase();
}

function matchCategory(text, rules) {
  const out = new Set();
  for (const r of rules) {
    if (r.k.some((kw) => text.includes(kw))) out.add(r.v);
  }
  return Array.from(out);
}

function profileSubject(subjectOrQuery) {
  const text = normalize(subjectOrQuery);
  const profile = {
    environment: matchCategory(text, KEYWORDS.environment),
    platform: matchCategory(text, KEYWORDS.platform),
    modality: matchCategory(text, KEYWORDS.modality),
    data_sensitivity: matchCategory(text, KEYWORDS.data_sensitivity)
  };

  // Defaults if empty
  if (profile.environment.length === 0) {
    // If platform suggests cloud, infer cloud; if ollama/local, infer on-prem/pc
    if (profile.platform.includes('azure') || profile.platform.includes('aws') || profile.platform.includes('gcp') || profile.platform.includes('openai')) {
      profile.environment.push('cloud');
    } else if (profile.platform.includes('ollama') || profile.platform.includes('local')) {
      profile.environment.push('pc');
      profile.environment.push('on-prem');
    }
  }

  logger.info('Profiled subject', profile);
  return profile;
}

module.exports = { profileSubject };
