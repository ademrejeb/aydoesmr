-- TechDebt AI - Initial Database Schema
-- PostgreSQL 15+

BEGIN;

-- ─── Users & Organizations ─────────────────────────────────

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    github_id VARCHAR(255) UNIQUE,
    github_token TEXT,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) DEFAULT 'free',
    billing_email VARCHAR(255),
    trial_end TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'active',
    subscription_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, team_id)
);

-- ─── Projects & Repositories ───────────────────────────────

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    repo_url TEXT,
    repo_id VARCHAR(255),
    default_branch VARCHAR(255) DEFAULT 'main',
    visibility VARCHAR(50) DEFAULT 'private',
    webhook_secret VARCHAR(255),
    tech_debt_score FLOAT DEFAULT 0.0,
    scanning_status VARCHAR(50) DEFAULT 'idle',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    full_path VARCHAR(500),
    clone_url TEXT,
    default_branch VARCHAR(255) DEFAULT 'main',
    size_kb BIGINT DEFAULT 0,
    language VARCHAR(100),
    analysis_started_at TIMESTAMPTZ,
    tech_debt_ratio FLOAT DEFAULT 0.0,
    coverage FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Commits ───────────────────────────────────────────────

CREATE TABLE commits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sha VARCHAR(40) NOT NULL,
    message TEXT,
    author_name VARCHAR(255),
    author_email VARCHAR(255),
    authored_at TIMESTAMPTZ,
    committed_at TIMESTAMPTZ,
    additions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    total_changes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Scans ─────────────────────────────────────────────────

CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    commit_id UUID REFERENCES commits(id),
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_duration_ms BIGINT,
    files_scanned INTEGER DEFAULT 0,
    lines_analyzed BIGINT DEFAULT 0,
    has_issues BOOLEAN DEFAULT FALSE,
    has_error BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Metrics ───────────────────────────────────────────────

CREATE TABLE metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
    metric_type VARCHAR(100) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(255),
    category VARCHAR(100),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Rules ─────────────────────────────────────────────────

CREATE TABLE rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    language VARCHAR(100),
    condition_config JSONB NOT NULL DEFAULT '{}',
    suggestion_template TEXT,
    fix_template TEXT,
    confidence_threshold DOUBLE PRECISION DEFAULT 0.7,
    requires_approval BOOLEAN DEFAULT TRUE,
    is_custom BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Issues ────────────────────────────────────────────────

CREATE TABLE issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    column_start INTEGER DEFAULT 0,
    column_end INTEGER DEFAULT 0,
    message TEXT NOT NULL,
    severity VARCHAR(50) NOT NULL,
    confidence DOUBLE PRECISION DEFAULT 0.0,
    rule_id UUID REFERENCES rules(id) ON DELETE SET NULL,
    fingerprint VARCHAR(64),
    is_fixed BOOLEAN DEFAULT FALSE,
    fixed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Fixes ─────────────────────────────────────────────────

CREATE TABLE fixes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    fix_type VARCHAR(50) NOT NULL,
    description TEXT,
    refactoring_id UUID,
    status VARCHAR(50) DEFAULT 'pending',
    applied_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Plans & Patches ───────────────────────────────────────

CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    summary TEXT,
    confidence_score DOUBLE PRECISION DEFAULT 0.0,
    estimated_effort_ms BIGINT,
    priority VARCHAR(50) DEFAULT 'medium',
    status VARCHAR(50) DEFAULT 'draft',
    rollback_strategy TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
    original_code TEXT,
    refactored_code TEXT,
    file_path TEXT,
    line_start INTEGER,
    line_end INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Refactorings ──────────────────────────────────────────

CREATE TABLE refactorings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
    issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
    original_code TEXT NOT NULL,
    refactored_code TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    status VARCHAR(50) DEFAULT 'planned',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,
    rollback_commit VARCHAR(40),
    rollback_available BOOLEAN DEFAULT FALSE,
    validation_results JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AI Calls ──────────────────────────────────────────────

CREATE TABLE ai_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    type VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    prompt TEXT,
    response TEXT,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    cost DOUBLE PRECISION DEFAULT 0.0,
    duration_ms BIGINT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Billing ───────────────────────────────────────────────

CREATE TABLE billing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    plan_type VARCHAR(50) DEFAULT 'free',
    status VARCHAR(50) DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    seats INTEGER DEFAULT 1,
    usage_this_period DOUBLE PRECISION DEFAULT 0.0,
    usage_limit DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ───────────────────────────────────────────────

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_github_id ON users(github_id);

CREATE INDEX idx_projects_org_id ON projects(org_id);
CREATE INDEX idx_projects_owner_id ON projects(owner_id);

CREATE INDEX idx_repositories_project_id ON repositories(project_id);

CREATE INDEX idx_commits_project_id ON commits(project_id);
CREATE INDEX idx_commits_sha ON commits(sha);

CREATE INDEX idx_scans_project_id ON scans(project_id);
CREATE INDEX idx_scans_status ON scans(status);
CREATE INDEX idx_scans_commit_id ON scans(commit_id);

CREATE INDEX idx_metrics_project_id ON metrics(project_id);
CREATE INDEX idx_metrics_scan_id ON metrics(scan_id);
CREATE INDEX idx_metrics_timestamp ON metrics(timestamp);
CREATE INDEX idx_metrics_metric_type ON metrics(metric_type);

CREATE INDEX idx_issues_scan_id ON issues(scan_id);
CREATE INDEX idx_issues_severity ON issues(severity);
CREATE INDEX idx_issues_is_fixed ON issues(is_fixed);
CREATE INDEX idx_issues_fingerprint ON issues(fingerprint);

CREATE INDEX idx_fixes_issue_id ON fixes(issue_id);
CREATE INDEX idx_fixes_status ON fixes(status);

CREATE INDEX idx_plans_project_id ON plans(project_id);
CREATE INDEX idx_patches_plan_id ON patches(plan_id);

CREATE INDEX idx_refactorings_project_id ON refactorings(project_id);
CREATE INDEX idx_refactorings_status ON refactorings(status);
CREATE INDEX idx_refactorings_plan_id ON refactorings(plan_id);

CREATE INDEX idx_ai_calls_project_id ON ai_calls(project_id);
CREATE INDEX idx_ai_calls_created_at ON ai_calls(created_at);
CREATE INDEX idx_ai_calls_type ON ai_calls(type);

CREATE INDEX idx_billing_org_id ON billing(organization_id);

CREATE INDEX idx_rules_org_id ON rules(organization_id);
CREATE INDEX idx_rules_category ON rules(category);
CREATE INDEX idx_rules_language ON rules(language);

-- ─── Partitioning (Issues by month) ────────────────────────

-- Note: Partitioning requires creating partitioned tables.
-- Below is an example for future large-scale deployments.

-- ─── Materialized Views ────────────────────────────────────

CREATE MATERIALIZED VIEW daily_project_metrics AS
SELECT
    project_id,
    date_trunc('day', created_at) AS day,
    COUNT(DISTINCT scan_id) AS total_scans,
    COUNT(DISTINCT id) AS total_issues,
    COUNT(DISTINCT CASE WHEN severity = 'critical' THEN id END) AS critical_issues,
    COUNT(DISTINCT CASE WHEN severity = 'high' THEN id END) AS high_issues,
    COUNT(DISTINCT CASE WHEN severity = 'medium' THEN id END) AS medium_issues,
    COUNT(DISTINCT CASE WHEN severity = 'low' THEN id END) AS low_issues,
    COUNT(DISTINCT CASE WHEN is_fixed = TRUE THEN id END) AS fixed_issues
FROM issues
GROUP BY project_id, date_trunc('day', created_at);

CREATE UNIQUE INDEX idx_daily_project_metrics ON daily_project_metrics(project_id, day);

COMMIT;
