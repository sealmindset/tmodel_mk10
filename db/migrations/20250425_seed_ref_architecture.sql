-- Seed primary categories
INSERT INTO threat_model.reference_architecture_category (name) VALUES
  ('Access Control'),
  ('Data Protection'),
  ('Secure SDLC & Secure Processes'),
  ('Design'),
  ('Operations Support & Maintenance')
ON CONFLICT (name) DO NOTHING;

-- Seed options for Access Control
INSERT INTO threat_model.reference_architecture_option (category_id, name)
SELECT id, opt FROM threat_model.reference_architecture_category, (VALUES
  ('Authentication & Password Management'),
  ('Authorization & User Role Management'),
  ('Account Management')
) AS v(opt)
WHERE name = 'Access Control'
ON CONFLICT (category_id, name) DO NOTHING;

-- Seed options for Data Protection
INSERT INTO threat_model.reference_architecture_option (category_id, name)
SELECT id, opt FROM threat_model.reference_architecture_category, (VALUES
  ('AV and anti-malware'),
  ('Cryptography'),
  ('Filesystem Security & Data Access'),
  ('Secure File Transfer'),
  ('Data Backups'),
  ('Certificate & PKI'),
  ('Application Firewall & WAF'),
  ('Secure Data Destruction')
) AS v(opt)
WHERE name = 'Data Protection'
ON CONFLICT (category_id, name) DO NOTHING;

-- Seed options for Secure SDLC & Secure Processes
INSERT INTO threat_model.reference_architecture_option (category_id, name)
SELECT id, opt FROM threat_model.reference_architecture_category, (VALUES
  ('SSDLC'),
  ('Secure Coding Best Practices'),
  ('Penetration Testing'),
  ('Security Reviews'),
  ('Threat Modeling'),
  ('Security Requirements'),
  ('Disaster Recovery & Business Continuity')
) AS v(opt)
WHERE name = 'Secure SDLC & Secure Processes'
ON CONFLICT (category_id, name) DO NOTHING;

-- Seed options for Design
INSERT INTO threat_model.reference_architecture_option (category_id, name)
SELECT id, opt FROM threat_model.reference_architecture_category, (VALUES
  ('Non-Production Environment'),
  ('Configuration Management'),
  ('Database Security'),
  ('Endpoint Security')
) AS v(opt)
WHERE name = 'Design'
ON CONFLICT (category_id, name) DO NOTHING;

-- Seed options for Operations Support & Maintenance
INSERT INTO threat_model.reference_architecture_option (category_id, name)
SELECT id, opt FROM threat_model.reference_architecture_category, (VALUES
  ('Patching & Software Management'),
  ('Training & Certifications'),
  ('Metrics & Reporting'),
  ('File Integrity Monitoring'),
  ('Whitelisting'),
  ('Change Management'),
  ('Continuous Integration and Continuous Deployment'),
  ('Logging/Monitoring'),
  ('Vulnerability Management'),
  ('Software/Hardware Inventory'),
  ('Data Retention'),
  ('Compliance & Audit Support'),
  ('Automation'),
  ('Defect Management')
) AS v(opt)
WHERE name = 'Operations Support & Maintenance'
ON CONFLICT (category_id, name) DO NOTHING;
