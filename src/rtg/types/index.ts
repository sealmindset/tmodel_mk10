// Shared RTG types
export interface RtgFilters {
  author?: string;
  ci_example?: string;
  projectUuid?: string;
  project_id?: string;
  projectId?: string;
  pipeline_steps?: unknown[];
  tags?: Record<string, unknown>;
  aws_accounts?: unknown[];
}

export interface CompileRequest {
  content: string;
  filters?: RtgFilters;
}

export interface CompileWarning {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface CompileResult {
  content: string;
  warnings: CompileWarning[];
  meta: {
    generatedAt: string;
    author: string;
    env: string;
  };
}
