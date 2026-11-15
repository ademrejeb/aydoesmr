import type { Locale } from "./config"

export interface Dictionary {
  nav: { title: string; subtitle: string; dashboard: string; scan: string; git: string; timesheet: string; leave: string; holidays: string; leave_settings: string }
  hero: { title: string; description: string; analyze_now: string }
  tabs: { paste: string; project: string; git: string }
  paste: {
    title: string
    placeholder: string
    language_label: string
    languages: Record<string, string>
    analyze: string
    analyzing: string
  }
  project: {
    title: string
    description: string
    path_label: string
    path_placeholder: string
    scan: string
    scanning: string
    include_ignored: string
  }
  git: {
    title: string
    description: string
    local_tab: string
    remote_tab: string
    local_placeholder: string
    remote_placeholder: string
    analyze: string
    analyzing: string
  }
  results: {
    title: string
    metrics: string
    lines_of_code: string
    cyclomatic_complexity: string
    maintainainability_index: string
    issues_found: string
    rules_triggered: string
    no_issues: string
    severity_critical: string
    severity_high: string
    severity_medium: string
    severity_low: string
    line: string
    suggestion: string
    fix_template: string
    suggestion_copied: string
    copy_suggestion: string
    no_suggestion: string
    severity_info: string
  }
  git_results: {
    branch: string
    last_commit: string
    author: string
    date: string
    remote: string
    tracked_files: string
    total_commits: string
    repo_status: string
    clean: string
    dirty: string
  }
  footer: { built_with: string; rust_go_next: string }
  teams: {
    title: string
    no_teams: string
    create: string
    name: string
    description: string
    members: string
    add_member: string
    no_members: string
    no_candidates: string
    remove: string
    owner: string
    member: string
    search_placeholder: string
  }
  planner: {
    title: string
    open: string
    subtitle: string
    upload_title: string
    upload_hint: string
    choose_file: string
    change_file: string
    sprint_name: string
    sprint_name_placeholder: string
    generate: string
    generating: string
    preview_title: string
    document: string
    tickets_count: string
    epics_count: string
    chars_count: string
    ai_note: string
    no_tickets: string
    project: string
    select_project: string
    team: string
    no_team: string
    story_points: string
    apply: string
    applying: string
    success_title: string
    success_desc: string
    view_board: string
    done: string
    back: string
    error: string
  }
  messages: {
    title: string
    new_message: string
    new_group: string
    no_conversations: string
    type_message: string
    send: string
    members: string
    online: string
    typing: string
    start_conversation: string
    start: string
    group_name: string
    select_members: string
    leave_group: string
    add_member: string
    inviter: string
    all_members: string
    emoji: string
    stickers: string
    gifs: string
    sticker: string
    gif: string
    gif_search: string
    gif_key_hint: string
    attachment: string
    attachments: string
    upload_error: string
    status_available: string
    status_away: string
    status_busy: string
    status_offline: string
    last_seen: string
    read: string
    set_status: string
    clear_status: string
    add_reaction: string
    delete_message: string
    deleted_message: string
    archive_conversation: string
    unarchive_conversation: string
    archived: string
    archive_hidden: string
    open_chat_window: string
    chat_window_title: string
    call: string
    calling: string
    incoming_call: string
    accept: string
    decline: string
    end_call: string
    mute_mic: string
    mute_video: string
    call_ended: string
  }
  invite: {
    title: string
    invite: string
    email: string
    email_placeholder: string
    role: string
    send_invite: string
    invites: string
    no_invites: string
    pending: string
    accepted: string
    revoked: string
    revoke: string
    sent: string
    add_existing: string
    welcome_title: string
    welcome_subtitle: string
    create_account: string
    confirm_password: string
    password_mismatch: string
    invalid_token: string
    join_org: string
    already_member: string
  }
  errors: {
    empty_code: string
    invalid_path: string
    scan_failed: string
    git_failed: string
    network_error: string
    not_found: string
  }
  auth: {
    login_title: string
    register_title: string
    subtitle: string
    email: string
    password: string
    full_name: string
    sign_in: string
    sign_up: string
    submitting: string
    switch_to_register: string
    switch_to_login: string
    err_required: string
    err_invalid: string
    err_generic: string
    basacore_login: string
  }
  platform: {
    overview: string
    projects: string
    repositories: string
    teams: string
    messages: string
    dev: string
    dev_rules: string
    issues: string
    agent_factory: string
    notifications: string
    no_notifications: string
    admin: string
    service_desk_section: string
    service_desk: string
    service_requests: string
    service_incidents: string
    service_knowledge: string
    timesheet: string
    leave: string
    holidays: string
    leave_settings: string
    management: string
    organizations: string
    create_org: string
    org_name: string
    create_org_btn: string
    no_orgs: string
    create_first_org: string
    logout: string
    welcome: string
    cancel: string
    close: string
    menu: string
    search_trigger: string
    new: string
    new_project: string
    new_repository: string
    new_message: string
    workspace: string
    engineering: string
    profile: string
    settings: string
    sign_out: string
    collapse: string
    expand: string
    mark_all_read: string
    loading: string
    pipelines: string
    new_pipeline: string
    ai: string
    new_ai: string
    servers: string
    payroll: string
  }
  timesheet: {
    title: string
    subtitle: string
    week_of: string
    total_hours: string
    day_hours: string
    hour_short: string
    save: string
    saving: string
    saved: string
    submit: string
    submitting: string
    submitted: string
    approved: string
    rejected: string
    draft: string
    error_load: string
    empty: string
    hour: string
    hours: string
    add_entry: string
    activity: string
    activity_placeholder: string
    project: string
    task: string
    select_project: string
    select_task: string
    previous: string
    next: string
    today: string
    history: string
    empty_history: string
    invalid_hours: string
    hours_min: string
    hours_max: string
    export_csv: string
    import_csv: string
    importing: string
    import_done: string
    import_failed: string
    day_labels: string[]
    view_month: string
    view_list: string
    off_day: string
  }
  payroll: {
    title: string
    subtitle: string
    no_runs: string
    create_run: string
    create_run_btn: string
    month_label: string
    month_hint: string
    currency: string
    notes: string
    run_exists: string
    run_created: string
    history: string
    status: string
    status_pending: string
    status_paid: string
    month: string
    generated: string
    created_at: string
    employees: string
    total_hours: string
    gross_total: string
    net_total: string
    actions: string
    generate: string
    generating: string
    generated_ok: string
    mark_paid: string
    mark_paid_confirm: string
    marked_paid_ok: string
    export_csv: string
    export_ok: string
    import_csv: string
    import_title: string
    import_hint: string
    upload_csv: string
    import_ok: string
    import_errors: string
    entries: string
    member: string
    hours: string
    regular: string
    overtime: string
    rate: string
    bonus: string
    gross: string
    net: string
    override: string
    overrides: string
    apply_override: string
    override_ok: string
    no_entries: string
    generate_first: string
    paid_at: string
    busy: string
  }
  leave: {
    title: string
    subtitle: string
    types: string
    balances: string
    requests: string
    new_request: string
    leave_type: string
    select_type: string
    start_date: string
    end_date: string
    days: string
    computed_days: string
    reason: string
    reason_placeholder: string
    submit: string
    submitting: string
    submitted: string
    cancel: string
    pending: string
    approved: string
    rejected: string
    cancelled: string
    error_load: string
    empty_requests: string
    request_success: string
    error_submit: string
    no_balances: string
    year: string
    granted: string
    used: string
    carried_over: string
    balance_remaining: string
    my_leave: string
    approvals: string
    approve: string
    reject: string
    review_note: string
    auto_approved: string
    needs_approval: string
    remaining_after: string
    empty_queue: string
    approved_success: string
    rejected_success: string
    cancelled_success: string
    no_types: string
    calendar: string
    calendar_hint: string
    upcoming: string
    next_leave: string
    no_upcoming: string
  }
  leave_settings: {
    title: string
    subtitle: string
    types: string
    balances: string
    new_type: string
    edit_type: string
    name: string
    code: string
    color: string
    is_paid: string
    days_per_year: string
    carry_over: string
    accrual_per_month: string
    requires_approval: string
    is_active: string
    create: string
    creating: string
    saving: string
    save_changes: string
    empty_types: string
    active: string
    inactive: string
    paid: string
    unpaid: string
    created: string
    updated: string
    error_load: string
    error_save: string
    balances_note: string
    no_balances: string
    balance_updated: string
    granted: string
    used: string
    pending: string
    adjusted: string
    carried_over: string
    remaining: string
    calendar_source: string
    calendar_hint: string
    manage_holidays: string
    member: string
    all_members: string
  }
  holidays: {
    title: string
    subtitle: string
    year: string
    year_placeholder: string
    load: string
    loading: string
    holiday: string
    holidays: string
    month: string
    date: string
    name: string
    local_name: string
    empty: string
    error_load: string
    source_note: string
    country: string
    region: string
    region_placeholder: string
    defaults_saved: string
    defaults_error: string
    months: string[]
    off_day: string
    mark_off_day: string
    remove_off_day: string
    off_day_note: string
    off_days_selected: string
    off_day_toggle_error: string
  }
  search: {
    placeholder: string
    navigate: string
    conversations: string
    switch_org: string
    no_results: string
    hint: string
    recent: string
  }
  projects: {
    title: string
    create: string
    new_project: string
    name: string
    key: string
    type: string
    types: Record<string, string>
    color: string
    empty: string
    view: string
    tasks: string
    boards: string
    created: string
    all: string
    no_match: string
  }
  board: {
    add_task: string
    task_title: string
    task_placeholder: string
    priority: string
    low: string
    medium: string
    high: string
    urgent: string
    due: string
  }
  agile: {
    board: string
    backlog: string
    sprints: string
    team: string
    teams: string
    all_teams: string
    no_teams_linked: string
    points: string
    point_estimate: string
    new_sprint: string
    sprint_name: string
    sprint_goal: string
    start_date: string
    end_date: string
    create: string
    configure_workflow: string
    workflow_name: string
    new_column: string
    column_name: string
    column_status: string
    is_backlog: string
    wip_limit: string
    delete: string
    start: string
    complete: string
    cancel: string
    planned_sprints: string
    completed_sprints: string
    tasks_in_sprint: string
    add: string
    search: string
    details: string
    assignee: string
    no_assignee: string
    type: string
    types: Record<string, string>
    comments: string
    no_comments: string
    comment_placeholder: string
    read_only: string
    epic: string
    no_epic: string
    epics_title: string
    new_epic: string
    unassigned: string
    all_priorities: string
    all_types: string
    my_tasks: string
    clear: string
  }
  repo: {
    tab: string
    title: string
    subtitle: string
    link_repository: string
    url_label: string
    url_placeholder: string
    token_label: string
    token_placeholder: string
    name_label: string
    connect: string
    connecting: string
    unlink: string
    empty: string
    branches: string
    recent_commits: string
    latest_commit: string
    provider: string
    default_branch: string
    size: string
    language: string
    last_sync: string
    never: string
    scan: string
    scanning: string
    scan_on_push: string
    webhook_url: string
    copy: string
    copied: string
    issues_found: string
    clean_scan: string
    status: string
    files: string
    lines: string
    issues: string
    triage: string
    no_issues: string
    read_only: string
    refresh: string
    confirm_unlink: string
  }
  admin: {
    tab: string
    subtitle: string
    not_admin: string
    back_to_dashboard: string
    overview: string
    members: string
    invites: string
    tokens: string
    roles: string
    audit: string
    settings: string
    stat_members: string
    stat_invites: string
    stat_projects: string
    stat_audit_events: string
    plan: string
    seats: string
    member_updated: string
    member_removed: string
    cannot_remove_owner: string
    cannot_remove_self: string
    already_member: string
    member_roles: Record<string, string>
    save: string
    remove: string
    title: string
    status: string
    when: string
    email: string
    invite_sent: string
    invite_revoked: string
    send_invite: string
    pending: string
    accepted: string
    revoked: string
    token_name: string
    create_token: string
    created_token: string
    copy: string
    copied: string
    token_revoked: string
    no_tokens: string
    last_used: string
    never: string
  access_intro: string
  access_list_intro: string
  nav_sections: string
  nav_sections_hint: string
    audit_intro: string
    no_audit: string
    all_actions: string
    settings_intro: string
    org_name: string
    org_slug: string
    billing_email: string
    timezone: string
    currency: string
    locale: string
    holiday_country: string
    holiday_region: string
    work_week_start: string
    saved: string
    storage_attachments: string
    storage_driver: string
    storage_local: string
    storage_s3: string
    storage_bucket: string
    storage_endpoint: string
    storage_max: string
  }
  githost: {
    title: string
    subtitle: string
    create: string
    new_repository: string
    name: string
    name_placeholder: string
    description: string
    visibility: string
    private: string
    public: string
    init_readme: string
    link_project: string
    no_project: string
    create_busy: string
    empty: string
    default_branch: string
    size: string
    files: string
    branches: string
    commits_title: string
    files_title: string
    readme: string
    latest_commit: string
    clone_url: string
    push_command: string
    add_file: string
    new_file: string
    file_path: string
    file_content: string
    commit_message: string
    commit: string
    committing: string
    scan: string
    scanning: string
    delete: string
    delete_confirm: string
    tokens_title: string
    create_token: string
    new_token: string
    token_name: string
    created_token: string
    copy: string
    copied: string
    revoke: string
    no_tokens: string
    last_push: string
    never: string
    visibility_label: string
    open_in_editor: string
    languages: string
    contributors: string
    no_commits: string
    no_files: string
  }
  dev: {
    title: string
    subtitle: string
    analyze: string
    pasted: string
    scans: string
    no_issues: string
    issues_title: string
    triage: string
    triaged: string
    scan_now: string
    recent_scans: string
    code_health: string
    complexity: string
    maintainability: string
    inline: string
    all_severities: string
    all_status: string
    open: string
    fixed: string
    group_by_file: string
    files: string
    issues_count: string
    explain: string
    explaining: string
    explanation: string
    fix_suggested: string
    copy: string
    copied: string
    settings: string
    threshold: string
    ignore_rules: string
    save: string
    saved: string
    debt_trend: string
    no_data: string
    mark_fixed: string
    reopen: string
    all_rules: string
    filter_rule: string
    open_issues: string
    fixed_issues: string
    total_issues: string
    top_rules: string
    view_issues: string
    filter_scan: string
    exclude_paths: string
    include_paths: string
    path_hint: string
    rules_title: string
    rules_subtitle: string
    rules_search: string
    rules_search_placeholder: string
    rules_category: string
    rules_severity: string
    rules_language: string
    rules_all: string
    rules_enabled_only: string
    rules_enabled: string
    rules_disabled: string
    rules_total: string
    rules_save: string
    rules_saved: string
    rules_reset: string
    rules_reset_confirm: string
    rules_no_results: string
    rules_applies_to: string
    rules_runtime_note: string
    rules_metric: string
    rules_readonly: string
    issues_search: string
    issues_no_match: string
    clear_filters: string
  }
  pipeline: {
    title: string
    subtitle: string
    create: string
    new_pipeline: string
    name: string
    name_placeholder: string
    description: string
    description_placeholder: string
    repository: string
    repository_placeholder: string
    trigger: string
    trigger_manual: string
    trigger_push: string
    branch: string
    branch_placeholder: string
    steps: string
    step_name: string
    step_command: string
    add_step: string
    remove_step: string
    create_busy: string
    empty: string
    run: string
    running: string
    cancel: string
    cancelling: string
    ran: string
    status: string
    queued: string
    success: string
    failed: string
    cancelled: string
    duration: string
    runs_title: string
    no_runs: string
    runs: string
    never: string
    active: string
    disabled: string
    delete: string
    delete_confirm: string
    edit: string
    saved: string
    run_triggered: string
    run_cancelled: string
    created: string
    deleted: string
    triggered_by: string
    branch_label: string
    repo_label: string
    steps_label: string
    last_run: string
    start: string
    output: string
    command: string
    logs: string
    back: string
    started: string
    finished: string
    now: string
    seconds: string
  }
  ai: {
    title: string
    subtitle: string
    new_provider: string
    create: string
    edit: string
    name: string
    name_placeholder: string
    provider: string
    provider_placeholder: string
    provider_type: Record<string, string>
    base_url: string
    base_url_placeholder: string
    api_key: string
    api_key_placeholder: string
    api_key_optional: string
    key_configured: string
    models: string
    add_model: string
    model_placeholder: string
    remove: string
    fetch_models: string
    fetching: string
    default_model: string
    default_model_placeholder: string
    test: string
    testing: string
    test_ok: string
    test_fail: string
    last_test: string
    never_tested: string
    status: string
    active: string
    disabled: string
    enable: string
    disable: string
    delete: string
    delete_confirm: string
    created: string
    updated: string
    deleted: string
    models_fetched: string
    playground: string
    playground_hint: string
    chat_placeholder: string
    send: string
    sending: string
    reply: string
    no_models: string
    empty: string
    save: string
    saved: string
    cancel: string
    close: string
    busy: string
    no_key: string
    total_tokens: string
    duration: string
    connected: string
    provided_providers: string
    tab_providers: string
    tab_analysis: string
    analysis_subtitle: string
    source_label: string
    source_placeholder: string
    language_label: string
    analyze: string
    analyzing: string
    gateway_ok: string
    gateway_down: string
    engine_base: string
    engine_version: string
    analysis_failed: string
    empty_error: string
  }
  assistant: {
    title: string
    subtitle: string
    placeholder: string
    ask: string
    thinking: string
    summary_mode: string
    ai_mode: string
    clear: string
    empty: string
  }
  ai_actions: {
    title: string
    subtitle: string
    refresh: string
    tab_actions: string
    catalog: string
    runs: string
    empty: string
    no_provider: string
    available: string
    run: string
    run_action: string
    running: string
    busy: string
    close: string
    back: string
    preview: string
    apply: string
    applied: string
    applying: string
    already_applied: string
    apply_error: string
    advisory: string
    error_title: string
    error_subtitle: string
    run_by: string
    provider: string
    model: string
    duration: string
    status: string
    status_completed: string
    status_failed: string
    cancel: string
    action_name: Record<string, string>
    action_desc: Record<string, string>
    step_label: string
    step_desc: string
    repository_label: string
    repository_placeholder: string
    source_label: string
    source_placeholder: string
    pipeline_label: string
    pipeline_placeholder: string
    steps_label: string
    steps_placeholder: string
    issue_count: string
    language_label: string
    select_language: string
    run_now: string
    no_repositories: string
    steps_pasted: string
    created_tasks: string
    committed_file: string
    steps_applied: string
    applied_at: string
    used_default: string
  }
  servers: {
    title: string
    subtitle: string
    new_server: string
    refresh: string
    edit: string
    delete: string
    delete_confirm: string
    name: string
    name_placeholder: string
    host: string
    host_placeholder: string
    port: string
    protocol: string
    username: string
    username_placeholder: string
    credential: string
    credential_placeholder: string
    credential_configured: string
    protocols: Record<string, string>
    probe_now: string
    probing: string
    never_tested: string
    reachable: string
    unreachable: string
    last_probe: string
    probe_error: string
    probe_note: string
    empty_title: string
    empty_desc: string
    created: string
    updated: string
    saved: string
    deleted: string
    probe_ok: string
    probe_fail: string
    apps: string
    manage_apps: string
    add_app: string
    app_name: string
    app_name_placeholder: string
    app_url: string
    app_url_placeholder: string
    probe_path: string
    probe_path_placeholder: string
    probe_method: string
    no_apps: string
    method_get: string
    method_post: string
    app_ok: string
    app_fail: string
    app_probe_ok: string
    app_probe_fail: string
    checked_at: string
    app_created: string
    app_updated: string
    app_deleted: string
    role_note: string
    cancel: string
    save: string
    busy: string
  }
  overview: {
    heading: string
    subheading: string
    quick_scan: string
    open_projects: string
    open_dev: string
    projects_count: string
    issues_count: string
    recent_activity: string
  }
  service: {
    title: string
    subtitle: string
    overview: string
    catalog: string
    requests: string
    incidents: string
    knowledge: string
    sla: string
    my_queue: string
    open_tickets: string
    pending_approvals: string
    breached_incidents: string
    unassigned: string
    sla_compliance: string
    avg_resolution: string
    avg_response: string
    satisfaction: string
    top_items: string
    workload: string
    recent_activity: string
    no_activity: string
    hours_unit: string
    minutes_unit: string
    new_request: string
    new_incident: string
    new_article: string
    new_item: string
    search_placeholder: string
    filter_all: string
    filter_mine: string
    filter_unassigned: string
    filter_open: string
    filter_breached: string
    status: string
    priority: string
    requester: string
    assignee: string
    category: string
    item: string
    created: string
    updated: string
    due: string
    target_date: string
    no_items: string
    no_items_hint: string
    no_requests: string
    no_incidents: string
    no_articles: string
    no_articles_hint: string
    title_field: string
    description_field: string
    email_field: string
    name_field: string
    phone_field: string
    priority_p1: string
    priority_p2: string
    priority_p3: string
    priority_p4: string
    requires_approval: string
    approval_required_hint: string
    estimated_days: string
    active: string
    inactive: string
    form_fields: string
    field_label: string
    field_key: string
    field_type: string
    field_required: string
    add_field: string
    save_item: string
    request_number: string
    decision_note: string
    approve: string
    reject: string
    start_work: string
    mark_fulfilled: string
    close_ticket: string
    cancel_ticket: string
    reopen: string
    resolve: string
    mark_closed: string
    rate_request: string
    rating_thanks: string
    internal_note: string
    internal_note_hint: string
    comment_placeholder: string
    send: string
    resolution: string
    root_cause: string
    resolution_placeholder: string
    root_cause_placeholder: string
    respond_target: string
    resolve_target: string
    responded_at: string
    resolved_at: string
    reopen_count: string
    breached: string
    on_track: string
    business_hours_only: string
    sla_save: string
    sla_defaults_hint: string
    restore_defaults: string
    minutes_short: string
    article_published: string
    article_draft: string
    publish: string
    unpublish: string
    helpful: string
    not_helpful: string
    views: string
    tags: string
    read_article: string
    body_field: string
    summary_field: string
    linked_request: string
    detail: string
    back: string
    link_portal: string
    view_catalog: string
    view_requests: string
    view_incidents: string
    view_knowledge: string
    public_title: string
    public_subtitle: string
    public_new_request: string
    public_report_issue: string
    public_track: string
    public_track_hint: string
    public_number: string
    public_choose_service: string
    public_priority_hint: string
    public_submit: string
    public_submitted: string
    public_keep_number: string
    public_ticket_status: string
    public_ticket_raised: string
    public_target: string
    public_not_found: string
    public_services: string
    public_fill_all: string
    public_your_email: string
    public_impact: string
    public_impact_hint: string
    public_wide_impact: string
    p1_hint: string
    p2_hint: string
    p3_hint: string
    p4_hint: string
  }
  common: {
    cancel: string
    save: string
    close: string
    edit: string
  }
}

export const dictionaries: Record<Locale, Dictionary> = {
  ar: {
    timesheet: {
      title: "الجدول الزمني",
      subtitle: "سجّل ساعات عملك الأسبوعية",
      week_of: "أسبوع",
      total_hours: "إجمالي الساعات",
      day_hours: "ساعات اليوم",
      hour_short: "س",
      save: "حفظ",
      saving: "جارٍ الحفظ…",
      saved: "تم الحفظ",
      submit: "إرسال",
      submitting: "جارٍ الإرسال…",
      submitted: "تم الإرسال",
      approved: "معتمد",
      rejected: "مرفوض",
      draft: "مسودة",
      error_load: "تعذّر تحميل الجدول الزمني",
      empty: "لا توجد سجلات لهذا الأسبوع",
      hour: "ساعة",
      hours: "ساعات",
      add_entry: "إضافة سجل",
      activity: "النشاط",
      activity_placeholder: "مثال: تطوير ميزة جديدة، إصلاح خلل",
      project: "المشروع",
      task: "المهمة",
      select_project: "اختر المشروع",
      select_task: "اختر المهمة",
      previous: "السابق",
      next: "التالي",
      today: "اليوم",
      history: "السجل السابق",
      empty_history: "لا توجد سجلات سابقة بعد",
      invalid_hours: "يجب أن تكون الساعات بين 0.5 و 24",
      hours_min: "الحد الأدنى 0.5 ساعة",
      hours_max: "الحد الأقصى 24 ساعة",
      export_csv: "تصدير CSV",
      import_csv: "استيراد CSV",
      importing: "جارٍ الاستيراد…",
      import_done: "تم استيراد {imported} من أصل {total} سطر",
      import_failed: "فشل استيراد ملف CSV",
      day_labels: ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"],
      view_month: "شهري",
      view_list: "قائمة",
      off_day: "عطلة",
    },
    payroll: {
      title: "الرواتب",
      subtitle: "إدارة رواتب المؤسسة من سجلات الوقت المعتمدة",
      no_runs: "لا توجد جولات رواتب بعد",
      create_run: "جولة جديدة",
      create_run_btn: "إنشاء جولة",
      month_label: "الشهر",
      month_hint: "YYYY-MM (مثال: 2026-01)",
      currency: "العملة",
      notes: "ملاحظات",
      run_exists: "توجد جولة رواتب بالفعل لهذا الشهر",
      run_created: "تم إنشاء جولة الرواتب",
      history: "جولات الرواتب",
      status: "الحالة",
      status_pending: "قيد الانتظار",
      status_paid: "مدفوعة",
      month: "الشهر",
      generated: "التوليد",
      created_at: "تاريخ الإنشاء",
      employees: "الموظفون",
      total_hours: "الساعات",
      gross_total: "الإجمالي",
      net_total: "الصافي",
      actions: "إجراءات",
      generate: "توليد",
      generating: "جارٍ التوليد…",
      generated_ok: "تم توليد الجولة من سجلات الوقت",
      mark_paid: "وضع كمدفوعة",
      mark_paid_confirm: "تحديد هذه الجولة كمدفوعة؟ لا يمكن التراجع.",
      marked_paid_ok: "تم تحديد الجولة كمدفوعة",
      export_csv: "تصدير CSV",
      export_ok: "تم تنزيل الملف",
      import_csv: "استيراد CSV",
      import_title: "استيراد تعديلات من CSV",
      import_hint: "الأعمدة: member_id (أو member_name), rate, bonus",
      upload_csv: "اختيار ملف CSV",
      import_ok: "تم استيراد {applied} تعديل",
      import_errors: "تم تخطي {skipped} صف",
      entries: "كشوف الرواتب",
      member: "الموظف",
      hours: "الساعات",
      regular: "عادية",
      overtime: "إضافي",
      rate: "السعر",
      bonus: "المكافأة",
      gross: "الإجمالي",
      net: "الصافي",
      override: "تعديل",
      overrides: "التعديلات",
      apply_override: "تطبيق",
      override_ok: "تم تطبيق التعديل",
      no_entries: "لا توجد كشوف بعد — قم بتوليد الجولة أولاً",
      generate_first: "قم بتوليد الجولة لحساب كشوف الرواتب",
      paid_at: "تاريخ الدفع",
      busy: "جارٍ المعالجة…",
    },
    leave: {
      title: "الإجازات",
      subtitle: "إدارة طلبات الإجازات والأرصدة",
      types: "الأنواع",
      balances: "الأرصدة",
      requests: "الطلبات",
      new_request: "طلب جديد",
      leave_type: "نوع الإجازة",
      select_type: "اختر نوع الإجازة",
      start_date: "تاريخ البداية",
      end_date: "تاريخ النهاية",
      days: "الأيام",
      computed_days: "أيام محسوبة",
      reason: "السبب",
      reason_placeholder: "اشرح سبب الطلب…",
      submit: "إرسال",
      submitting: "جارٍ الإرسال…",
      submitted: "تم الإرسال",
      cancel: "إلغاء",
      pending: "قيد الانتظار",
      approved: "معتمد",
      rejected: "مرفوض",
      cancelled: "ملغى",
      error_load: "تعذّر تحميل الطلبات",
      empty_requests: "لا توجد طلبات",
      request_success: "تم إرسال الطلب بنجاح",
      error_submit: "تعذّر إرسال الطلب",
      no_balances: "لا يوجد رصيد متاح لهذا النوع",
      year: "السنة",
      granted: "ممنوح",
      used: "مستخدم",
      carried_over: "منقول",
      balance_remaining: "الرصيد المتبقي",
      my_leave: "إجازاتي",
      approvals: "الموافقات",
      approve: "اعتماد",
      reject: "رفض",
      review_note: "ملاحظة المراجعة",
      auto_approved: "تُعتمد تلقائياً بدون مراجعة",
      needs_approval: "يتطلب موافقة المدير",
      remaining_after: "المتبقي بعد هذا الطلب",
      empty_queue: "لا توجد طلبات بانتظار المراجعة",
      approved_success: "تم اعتماد الطلب",
      rejected_success: "تم رفض الطلب",
      cancelled_success: "تم إلغاء الطلب",
      no_types: "لا توجد أنواع إجازات مفعّلة",
      calendar: "التقويم",
      calendar_hint: "إجازاتك وأيام عطلة الشركة في نظرة واحدة",
      upcoming: "القادم",
      next_leave: "الإجازة القادمة",
      no_upcoming: "لا توجد إجازات قادمة",
    },
    leave_settings: {
      title: "إعدادات الإجازات",
      subtitle: "إدارة أنواع الإجازات وأرصدة الفريق",
      types: "أنواع الإجازات",
      balances: "أرصدة الإجازات",
      new_type: "نوع إجازة جديد",
      edit_type: "تعديل النوع",
      name: "الاسم",
      code: "الرمز",
      color: "اللون",
      is_paid: "مدفوعة الأجر",
      days_per_year: "الأيام في السنة",
      carry_over: "أيام الترحيل",
      accrual_per_month: "الاستحقاق شهرياً",
      requires_approval: "يتطلب موافقة",
      is_active: "مفعّل",
      create: "إنشاء",
      creating: "جارٍ الإنشاء…",
      saving: "جارٍ الحفظ…",
      save_changes: "حفظ التغييرات",
      empty_types: "لا توجد أنواع إجازات بعد — أنشئ أول نوع",
      active: "مفعّل",
      inactive: "معطل",
      paid: "مدفوعة",
      unpaid: "غير مدفوعة",
      created: "تم إنشاء نوع الإجازة",
      updated: "تم تحديث نوع الإجازة",
      error_load: "تعذّر تحميل إعدادات الإجازات",
      error_save: "تعذّر حفظ نوع الإجازة",
      balances_note: "يمكن للمسؤولين تعديل الأرصدة الممنوحة والمنقولة والمعدَّلة لكل نوع إجازة.",
      no_balances: "لا توجد أرصدة لهذه السنة",
      balance_updated: "تم تحديث الرصيد",
      granted: "ممنوح",
      used: "مستخدم",
      pending: "قيد الانتظار",
      adjusted: "معدَّل",
      carried_over: "منقول",
      remaining: "المتبقي",
        calendar_source: "تقويم العطل",
        calendar_hint: "حدد بلد العطل الرسمية ويوم بداية أسبوع العمل، فهي تؤثر على احتساب أيام الإجازات.",
        manage_holidays: "إدارة العطل الرسمية",
       member: "العضو",
       all_members: "كل الأعضاء",
    },
    holidays: {
      title: "العطل الرسمية",
      subtitle: "قائمة العطل الرسمية حسب السنة",
      year: "السنة",
      year_placeholder: "مثال: 2026",
      load: "تحميل",
      loading: "جارٍ التحميل…",
      holiday: "عطلة",
      holidays: "عطل",
      month: "الشهر",
      date: "التاريخ",
      name: "الاسم",
      local_name: "الاسم المحلي",
      empty: "لا توجد عطل لهذه السنة",
      error_load: "تعذّر تحميل العطل",
      source_note: "المصدر: date-holidays (قاعدة بيانات العطل الرسمية المفتوحة)",
      country: "البلد",
      region: "المنطقة",
      region_placeholder: "كل المناطق",
      defaults_saved: "تم حفظ إعدادات العطل الافتراضية",
      defaults_error: "تعذّر حفظ إعدادات العطل",
      months: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
      off_day: "يوم عطلة",
      mark_off_day: "تعيين كيوم عطلة",
      remove_off_day: "إزالة من أيام العطلة",
      off_day_note: "العطل التي تحددها كأيام عطلة تظهر كمغلق (OFF) في الجدول الزمني للموظفين.",
      off_days_selected: "تم تحديد {count} كأيام عطلة",
      off_day_toggle_error: "تعذّر تحديث يوم العطلة",
    },
    nav: {
      title: "TechDebt AI",
      subtitle: "تحليل الديون التقنية",
      dashboard: "لوحة التحكم",
      scan: "مسح المشروع",
      git: "تكامل Git",
      timesheet: "الجدول الزمني",
      leave: "الإجازات",
      holidays: "العطل الرسمية",
      leave_settings: "إعدادات الإجازات",
    },
    hero: {
      title: "تحليل الديون التقنية بالذكاء الاصطناعي",
      description:
        "احصل على رؤية شاملة لحالة كودك — التعقيد، الأمن، الأداء، والقابلية للصيانة. يدعم العربية والإنجليزية والفرنسية.",
      analyze_now: "ابدأ التحليل",
    },
    tabs: {
      paste: "لصق الكود",
      project: "مسح مشروع",
      git: "مستودع Git",
    },
    paste: {
      title: "الصق كودك هنا",
      placeholder: "الصق الكود البرمجي هنا...",
      language_label: "لغة المصدر",
      languages: { rust: "Rust", typescript: "TypeScript", javascript: "JavaScript", python: "بايثون", go: "Go", java: "جافا", c: "C", ruby: "روبي", csharp: "C#", cpp: "C++", php: "PHP" },
      analyze: "تحليل",
      analyzing: "جاري التحليل...",
    },
    project: {
      title: "مسح مجلد المشروع",
      description: "أدخل مسار مجلد المشروع على جهازك",
      path_label: "مسار المجلد",
      path_placeholder: "مثال: C:\\Users\\you\\project أو /home/you/project",
      scan: "مسح",
      scanning: "جاري المسح...",
      include_ignored: "بما فيهم الملفات المخفية",
    },
    git: {
      title: "تحليل مستودع Git",
      description: "أدخل مسار مستودع Git محلي أو رابط مستودع",
      local_tab: "مسار محلي",
      remote_tab: "رابط مستودع",
      local_placeholder: "مثال: C:\\Users\\you\\my-repo",
      remote_placeholder: "مثال: https://github.com/user/repo.git",
      analyze: "تحليل",
      analyzing: "جاري التحليل...",
    },
    results: {
      title: "نتائج التحليل",
      metrics: "المؤشرات",
      lines_of_code: "أسطر الكود",
      cyclomatic_complexity: "التعقيد الدوري",
      maintainainability_index: "مؤشر القابلية للصيانة",
      issues_found: "المشاكل المكتشفة",
      rules_triggered: "القواعد المفعّلة",
      no_issues: "لا توجد مشاكل — كود نظيف!",
      severity_critical: "حرج",
      severity_high: "عالي",
      severity_medium: "متوسط",
      severity_low: "منخفض",
      line: "سطر",
      suggestion: "اقتراح",
      fix_template: "قالب الإصلاح",
      suggestion_copied: "تم نسخ الاقتراح",
      copy_suggestion: "نسخ الاقتراح",
      no_suggestion: "لا يوجد اقتراح إصلاح",
      severity_info: "معلومة",
    },
    git_results: {
      branch: "الفرع الحالي",
      last_commit: "آخر إيداع",
      author: "المؤلف",
      date: "التاريخ",
      remote: "البعيد",
      tracked_files: "الملفات المتتبعة",
      total_commits: "إجمالي الإيداعات",
      repo_status: "حالة المستودع",
      clean: "نظيف",
      dirty: "غير نظيف",
    },
    footer: {
      built_with: "صُنع بـ",
      rust_go_next: "Rust · Go · Next.js",
    },
    errors: {
      empty_code: "الرجاء إدخال كود للتحليل",
      invalid_path: "المسار غير صالح",
      scan_failed: "فشل المسح",
      git_failed: "فشل تحليل المستودع",
      network_error: "خطأ في الشبكة",
      not_found: "غير موجود",
    },
    auth: {
      login_title: "تسجيل الدخول",
      register_title: "إنشاء حساب",
      subtitle: "منصة التعاون الموحدة — العربية أولاً",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      full_name: "الاسم الكامل",
      sign_in: "دخول",
      sign_up: "تسجيل",
      submitting: "جارٍ الإرسال...",
      switch_to_register: "ليس لديك حساب؟ سجّل الآن",
      switch_to_login: "لديك حساب؟ سجّل الدخول",
      err_required: "يرجى ملء جميع الحقول",
      err_invalid: "بيانات غير صحيحة",
      err_generic: "تعذر الاتصال بالخادم",
      basacore_login: "المتابعة عبر Basacore",
    },
    platform: {
      overview: "نظرة عامة",
      projects: "المشاريع",
      repositories: "المستودعات",
      teams: "الفرق",
      messages: "الرسائل",
      dev: "تحليل الكود",
      dev_rules: "قواعد التحليل",
      issues: "المشاكل",
      agent_factory: "وكلاء الذكاء",
      notifications: "الإشعارات",
      no_notifications: "لا توجد إشعارات",
      admin: "الإدارة",
      service_desk_section: "الخدمة",
      service_desk: "إدارة الخدمات",
      service_requests: "الطلبات",
      service_incidents: "الحوادث",
      service_knowledge: "قاعدة المعرفة",
      organizations: "المؤسسات",
      create_org: "إنشاء مؤسسة",
      org_name: "اسم المؤسسة",
      create_org_btn: "إنشاء",
      no_orgs: "لا توجد مؤسسات بعد",
      create_first_org: "أنشئ مؤسستك الأولى للبدء",
      logout: "تسجيل الخروج",
      welcome: "مرحباً",
      cancel: "إلغاء",
      close: "إغلاق",
      menu: "القائمة",
      search_trigger: "بحث",
      new: "جديد",
      new_project: "مشروع جديد",
      new_repository: "مستودع جديد",
      new_message: "رسالة جديدة",
      workspace: "مساحة العمل",
      engineering: "الهندسة",
    timesheet: "الجدول الزمني",
    leave: "الإجازات",
    holidays: "العطل الرسمية",
    leave_settings: "إعدادات الإجازات",
    management: "الإدارة",
      profile: "الملف الشخصي",
      settings: "الإعدادات",
      sign_out: "تسجيل الخروج",
      collapse: "طي",
      expand: "توسيع",
      mark_all_read: "تعليم الكل كمقروء",
      loading: "جارٍ التحميل…",
      pipelines: "خطوط CI/CD",
      new_pipeline: "خط CI/CD جديد",
      ai: "الذكاء الاصطناعي",
      new_ai: "مزوّد جديد",
      servers: "الخوادم",
      payroll: "الرواتب",
    },
    search: {
      placeholder: "ابحث في المشاريع والمستودعات والمحادثات...",
      navigate: "تنقّل",
      conversations: "المحادثات",
      switch_org: "تبديل المؤسسة",
      no_results: "لا توجد نتائج",
      hint: "↑ ↓ للتنقل · ↵ للاختيار · esc للإغلاق",
      recent: "الأخيرة",
    },
    projects: {
      title: "المشاريع",
      create: "مشروع جديد",
      new_project: "إنشاء مشروع",
      name: "اسم المشروع",
      key: "المفتاح",
      type: "النوع",
      types: { GENERAL: "عام", ENGINEERING: "هندسة", MARKETING: "تسويق", SALES: "مبيعات", HR: "موارد بشرية", OTHER: "أخرى" },
      color: "اللون",
      empty: "لا توجد مشاريع بعد — أنشئ أول مشروع لك",
      view: "عرض",
      tasks: "مهام",
      boards: "لوحات",
      created: "تم الإنشاء",
      all: "الكل",
      no_match: "لا توجد مشاريع تطابق البحث أو عوامل التصفية",
    },
    board: {
      add_task: "مهمة جديدة",
      task_title: "عنوان المهمة",
      task_placeholder: "مثال: إصلاح خطأ تسجيل الدخول",
      priority: "الأولوية",
      low: "منخفضة",
      medium: "متوسطة",
      high: "عالية",
      urgent: "عاجلة",
      due: "الاستحقاق",
    },
    agile: {
      board: "المهام",
      backlog: "التراكم",
      sprints: "السباقات",
      team: "الفريق",
      teams: "الفرق",
      all_teams: "جميع الفرق",
      no_teams_linked: "لا توجد فرق مرتبطة",
      points: "نقاط",
      point_estimate: "تقدير القصة",
      new_sprint: "سباق جديد",
      sprint_name: "اسم السباق",
      sprint_goal: "الهدف",
      start_date: "تاريخ البداية",
      end_date: "تاريخ النهاية",
      create: "إنشاء",
      configure_workflow: "تخصيص سير العمل",
      workflow_name: "اسم سير العمل",
      new_column: "عمود جديد",
      column_name: "اسم العمود",
      column_status: "الحالة",
      is_backlog: "عمود التراكم",
      wip_limit: "حد العمل الجاري",
      delete: "حذف",
      start: "بدء",
      complete: "إكمال",
      cancel: "إلغاء",
      planned_sprints: "سباقات قيد التخطيط",
      completed_sprints: "سباقات مكتملة",
      tasks_in_sprint: "مهام السباق",
      add: "إضافة",
      search: "بحث…",
      details: "التفاصيل",
      assignee: "المنفّذ",
      no_assignee: "غير معيّن",
      type: "النوع",
      types: { EPIC: "ملحمة", STORY: "قصة", TASK: "مهمة", BUG: "خطأ", SUBTASK: "مهمة فرعية" },
      comments: "تعليقات",
      no_comments: "لا توجد تعليقات",
      comment_placeholder: "أضف تعليقاً…",
      read_only: "وضع القراءة فقط — يملك المشرفون صلاحيات التعديل",
      epic: "الملحمة",
      no_epic: "بدون ملحمة",
      epics_title: "الملاحم",
      new_epic: "ملحمة جديدة",
      unassigned: "بدون سباق",
      all_priorities: "كل الأولويات",
      all_types: "كل الأنواع",
      my_tasks: "مهامي",
      clear: "مسح",
    },
    repo: {
      tab: "Git",
      title: "مستودعات Git",
      subtitle: "اربط المستودعات وتتبّع الفروع والطرح وشغّل فحوصات كاملة للكود.",
      link_repository: "ربط مستودع",
      url_label: "رابط المستودع",
      url_placeholder: "https://github.com/org/repo.git",
      token_label: "رمز الوصول (للمستودعات الخاصة)",
      token_placeholder: "ghp_… أو PAT من GitLab — اختياري",
      name_label: "اسم العرض (اختياري)",
      connect: "اتصال",
      connecting: "جارٍ التحقق…",
      unlink: "فك الارتباط",
      empty: "لا توجد مستودعات مرتبطة بهذا المشروع بعد.",
      branches: "الفروع",
      recent_commits: "أحدث الالتزامات",
      latest_commit: "آخر التزام",
      provider: "المزود",
      default_branch: "الفرع الافتراضي",
      size: "الحجم",
      language: "اللغة",
      last_sync: "آخر مزامنة",
      never: "أبداً",
      scan: "فحص الآن",
      scanning: "جارٍ الفحص…",
      scan_on_push: "فحص تلقائي عند الدفع",
      webhook_url: "رابط الويبوهوك",
      copy: "نسخ",
      copied: "تم النسخ",
      issues_found: "مشكلة مكتشفة",
      clean_scan: "لا مشاكل",
      status: "الحالة",
      files: "ملفات",
      lines: "أسطر",
      issues: "المشاكل",
      triage: "إنشاء مهمة",
      no_issues: "شغّل فحصاً لكشف مشاكل الكود وتحويلها إلى مهام.",
      read_only: "يستطيع المديرون ربط وفك ربط المستودعات.",
      refresh: "تحديث",
      confirm_unlink: "سيُزال المستودع من هذا المشروع مع بقاء القضايا المفحوصة.",
    },
    admin: {
      tab: "الإدارة",
      subtitle: "إدارة الوصول والأدوار والدعوات وسجلات التدقيق عبر المؤسسة.",
      not_admin: "تحتاج صلاحيات إدارة على المؤسسة لعرض هذه الصفحة.",
      back_to_dashboard: "العودة إلى لوحة التحكم",
      overview: "نظرة عامة",
      members: "الأعضاء",
      invites: "الدعوات",
      tokens: "الرموز",
      roles: "الأدوار والصلاحيات",
      audit: "سجل التدقيق",
      settings: "الإعدادات",
      stat_members: "الأعضاء",
      stat_invites: "دعوات معلّقة",
      stat_projects: "المشاريع",
      stat_audit_events: "أحداث التدقيق",
      plan: "الخطة",
      seats: "المقاعد",
      member_updated: "تم تحديث العضو",
      member_removed: "تمت إزالة العضو",
      cannot_remove_owner: "لا يمكن إزالة المالك",
      cannot_remove_self: "لا يمكن إزالة حسابك الخاص",
      already_member: "هذا البريد عضو بالفعل — تحقق من الدعوات",
      member_roles: { OWNER: "المالك", ADMIN: "مدير", MANAGER: "مدير فريق", MEMBER: "عضو", VIEWER: "مشاهد" },
      save: "حفظ",
      remove: "إزالة",
      title: "المسمى الوظيفي",
      status: "الحالة",
      when: "متى",
      email: "البريد الإلكتروني",
      invite_sent: "تم إرسال الدعوة",
      invite_revoked: "تم إلغاء الدعوة",
      send_invite: "إرسال دعوة",
      pending: "معلّقة",
      accepted: "مقبولة",
      revoked: "ملغاة",
      token_name: "اسم الرمز",
      create_token: "إنشاء رمز",
      created_token: "تم إنشاء الرمز — انسخه الآن، لن يُعرض مجدداً",
      copy: "نسخ",
      copied: "تم النسخ",
      token_revoked: "تم إلغاء الرمز",
      no_tokens: "لا توجد رموز بعد",
      last_used: "آخر استخدام",
      never: "أبداً",
      access_intro: "كيف تُقدَّم الصلاحيات في حسابك",
      access_list_intro: "كل دور يمنح مجموعة صلاحيات محددة — من القراءة فقط للبث، حتى التحكم الكامل في المؤسسة.",
      nav_sections: "الأقسام المعروضة لكل دور",
      nav_sections_hint: "ما يراه كل دور في القائمة الجانبية يتبع نفس الصلاحيات التي تفرضها الواجهة البرمجية.",
      audit_intro: "سجلّ بجميع الإجراءات الحساسة داخل المؤسسة.",
      no_audit: "لا توجد أحداث تدقيق",
      all_actions: "كل الأحداث",
      settings_intro: "الإعدادات العامة للمؤسسة وتفضيلات الفوترة.",
      org_name: "اسم المؤسسة",
      org_slug: "المعرف المختصر",
      billing_email: "بريد الفوترة",
      timezone: "المنطقة الزمنية",
      currency: "العملة",
      locale: "اللغة",
      holiday_country: "بلد العطل الرسمية",
      holiday_region: "منطقة العطل الرسمية",
      work_week_start: "يبدأ أسبوع العمل يوم",
      saved: "تم الحفظ",
      storage_attachments: "تخزين المرفقات",
      storage_driver: "نظام التخزين",
      storage_local: "قرص محلي",
      storage_s3: "S3 / MinIO",
      storage_bucket: "الحاوية (Bucket)",
      storage_endpoint: "نقطة الوصول",
      storage_max: "الحد الأقصى للرفع",
    },
    githost: {
      title: "مستودعات Git",
      subtitle: "مستضاف على المنصة — أنشئ، ادفع، واسحب مباشرة إلى TechVerse.",
      create: "إنشاء مستودع",
      new_repository: "مستودع جديد",
      name: "الاسم",
      name_placeholder: "مثال: mobile-app",
      description: "الوصف",
      visibility: "الخصوصية",
      private: "خاص",
      public: "عام",
      init_readme: "تهيئة بـ README",
      link_project: "ربط بمشروع (اختياري)",
      no_project: "بدون مشروع",
      create_busy: "جارٍ الإنشاء...",
      empty: "لا توجد مستودعات بعد — أنشئ أول مستودع وادفع إليه.",
      default_branch: "الفرع الافتراضي",
      size: "الحجم",
      files: "ملفات",
      branches: "الفروع",
      commits_title: "الالتزامات",
      files_title: "الملفات",
      readme: "README",
      latest_commit: "آخر التزام",
      clone_url: "رابط الاستنساخ",
      push_command: "أوامر الدفع",
      add_file: "إضافة ملف",
      new_file: "ملف جديد",
      file_path: "مسار الملف",
      file_content: "المحتوى",
      commit_message: "رسالة الالتزام",
      commit: "الالتزام",
      committing: "جارٍ الالتزام...",
      scan: "فحص الآن",
      scanning: "جارٍ الفحص...",
      delete: "حذف المستودع",
      delete_confirm: "سيتم حذف المستودع والمحتوى على القرص نهائياً.",
      tokens_title: "رموز الوصول",
      create_token: "إنشاء رمز",
      new_token: "رمز وصول جديد",
      token_name: "اسم الرمز",
      created_token: "انسخه الآن — لن يظهر مجدداً!",
      copy: "نسخ",
      copied: "تم النسخ",
      revoke: "إبطال",
      no_tokens: "لا توجد رموز بعد.",
      last_push: "آخر دفع",
      never: "لم يدفع بعد",
      visibility_label: "الخصوصية",
      open_in_editor: "فتح في المحرر",
      languages: "اللغات",
      contributors: "المساهمون",
      no_commits: "لا توجد التزامات بعد",
      no_files: "لا توجد ملفات",
    },
    dev: {
      title: "تحليل الكود",
      subtitle: "اكتشف الديون التقنية ومشاكل الأمان — عبر محرك Rust",
      analyze: "تحليل",
      pasted: "تقنيات متطابقة",
      scans: "جلسات المسح",
      no_issues: "لا توجد مشاكل — كود نظيف!",
      issues_title: "المشاكل المكتشفة",
      triage: "تحويل إلى مهمة",
      triaged: "تم التحويل ✓",
      scan_now: "تحليل الآن",
      recent_scans: "أحدث الجلسات",
      code_health: "صحة الكود",
      complexity: "التعقيد",
      maintainability: "القابلية للصيانة",
      inline: "مباشر",
      all_severities: "كل الخطورة",
      all_status: "كل الحالات",
      open: "مفتوحة",
      fixed: "مُصلَحة",
      group_by_file: "تجميع حسب الملف",
      files: "ملفات",
      issues_count: "مشكلات",
      explain: "اشرح",
      explaining: "جارٍ الشرح…",
      explanation: "الشرح",
      fix_suggested: "إصلاح مقترح",
      copy: "نسخ",
      copied: "تم النسخ ✓",
      settings: "إعدادات التحليل",
      threshold: "الحد الأدنى",
      ignore_rules: "تجاهل القواعد",
      save: "حفظ",
      saved: "تم الحفظ ✓",
      debt_trend: "منحنى الديون التقنية",
      no_data: "لا توجد بيانات كافية بعد",
      mark_fixed: "تم الإصلاح",
      reopen: "إعادة فتح",
      all_rules: "كل القواعد",
      filter_rule: "تصفية حسب القاعدة",
      open_issues: "مفتوحة",
      fixed_issues: "مُصلَحة",
      total_issues: "الإجمالي",
      top_rules: "أكثر القواعد تكراراً",
      view_issues: "عرض المشاكل",
      filter_scan: "مسح واحد",
      exclude_paths: "استبعاد المسارات",
      include_paths: "تضمين المسارات",
      path_hint: "نهاية / تعني يحتوي على، بدونها تعني لاحقة — مثال: src/api/ أو .ts",
      rules_title: "قواعد التحليل",
      rules_subtitle: "فعّل أو عطّل القواعد المضمنة في المحرك. القواعد المعطّلة تُستثنى من كل عمليات الفحص.",
      rules_search: "بحث",
      rules_search_placeholder: "ابحث باسم القاعدة أو معرّفها…",
      rules_category: "الفئة",
      rules_severity: "الشدّة",
      rules_language: "اللغة",
      rules_all: "الكل",
      rules_enabled_only: "المفعّلة فقط",
      rules_enabled: "مفعّلة",
      rules_disabled: "معطّلة",
      rules_total: "الإجمالي",
      rules_save: "حفظ التغييرات",
      rules_saved: "تم حفظ قواعد التحليل",
      rules_reset: "استعادة الافتراضي",
      rules_reset_confirm: "إعادة تعيين كل القواعد للحالة الافتراضية؟",
      rules_no_results: "لا توجد قواعد مطابقة",
      rules_applies_to: "ينطبق على",
      rules_runtime_note: "تُحمَّل القواعد ديناميكيًا من محرك التحليل (Rust). عدد القواعد:",
      rules_metric: "القياس",
      rules_readonly: "لديك صلاحية قراءة فقط — تحتاج دور MEMBER أو أعلى لحفظ التغييرات.",
      issues_search: "البحث بالملف أو الرسالة…",
      issues_no_match: "لا توجد مشاكل تطابق عوامل التصفية",
      clear_filters: "مسح عوامل التصفية",
    },
    pipeline: {
      title: "خطوط CI/CD",
      subtitle: "شغّل الفحوص والبناء والنشر مباشرة على مستودعاتك المستضافة.",
      create: "إنشاء خط",
      new_pipeline: "خط جديد",
      name: "الاسم",
      name_placeholder: "مثال: CI: Studio Core",
      description: "الوصف",
      description_placeholder: "وصف الخط (اختياري)",
      repository: "المستودع",
      repository_placeholder: "اختر مستودعاً",
      trigger: "التشغيل",
      trigger_manual: "يدوي",
      trigger_push: "عند الدفع",
      branch: "الفرع",
      branch_placeholder: "main",
      steps: "الخطوات",
      step_name: "اسم الخطوة",
      step_command: "الأمر",
      add_step: "إضافة خطوة",
      remove_step: "إزالة",
      create_busy: "جارٍ الإنشاء...",
      empty: "لا توجد خطوط CI/CD بعد — أنشئ أول خط أو اربط مستودعاً.",
      run: "تشغيل",
      running: "جارٍ التشغيل...",
      cancel: "إلغاء",
      cancelling: "جارٍ الإلغاء...",
      ran: "آخر تشغيل",
      status: "الحالة",
      queued: "في الانتظار",
      success: "نجح",
      failed: "فشل",
      cancelled: "ملغى",
      duration: "المدة",
      runs_title: "سجل التشغيلات",
      no_runs: "لا توجد تشغيلات بعد — شغّل الخط للبدء.",
      runs: "تشغيلات",
      never: "أبداً",
      active: "مفعّل",
      disabled: "معطل",
      delete: "حذف الخط",
      delete_confirm: "سيتم حذف الخط وسجل تشغيلاته نهائياً.",
      edit: "تعديل",
      saved: "تم الحفظ",
      run_triggered: "تم تشغيل الخط",
      run_cancelled: "تم إلغاء التشغيل",
      created: "تم إنشاء الخط",
      deleted: "تم حذف الخط",
      triggered_by: "بواسطة",
      branch_label: "الفرع",
      repo_label: "المستودع",
      steps_label: "الخطوات",
      last_run: "آخر تشغيل",
      start: "بدء",
      output: "المخرجات",
      command: "الأمر",
      logs: "السجلات",
      back: "رجوع",
      started: "بدأ",
      finished: "انتهى",
      now: "الآن",
      seconds: "ثانية",
    },
    ai: {
      title: "الذكاء الاصطناعي",
      subtitle: "اربط مزوّدي النماذج — سحابة، مستضاف ذاتياً، أو محلي بالكامل.",
      new_provider: "مزوّد جديد",
      create: "إضافة",
      edit: "تعديل",
      name: "الاسم",
      name_placeholder: "مثال: OpenAI Cloud",
      provider: "المزوّد",
      provider_placeholder: "اختر المزوّد",
      provider_type: {
        openai: "OpenAI",
        anthropic: "Anthropic",
        google: "Google Gemini",
        groq: "Groq",
        mistral: "Mistral AI",
        openrouter: "OpenRouter",
        azure: "Azure OpenAI",
        ollama: "Ollama (محلي)",
        openai_compatible: "OpenAI متوافق (مستضاف ذاتياً)",
      },
      base_url: "عنوان الخادم",
      base_url_placeholder: "https://...",
      api_key: "مفتاح API",
      api_key_placeholder: "sk-...",
      api_key_optional: "اختياري",
      key_configured: "تم ضبط المفتاح",
      models: "النماذج",
      add_model: "إضافة نموذج",
      model_placeholder: "مثال: gpt-4o-mini",
      remove: "إزالة",
      fetch_models: "جلب النماذج",
      fetching: "جارِ الجلب...",
      default_model: "النموذج الافتراضي",
      default_model_placeholder: "اختر نموذجاً",
      test: "اختبار الاتصال",
      testing: "جارٍ الاختبار...",
      test_ok: "الاتصال ناجح",
      test_fail: "فشل الاتصال",
      last_test: "آخر اختبار",
      never_tested: "لم يُختبر بعد",
      status: "الحالة",
      active: "مفعّل",
      disabled: "معطل",
      enable: "تفعيل",
      disable: "تعطيل",
      delete: "حذف المزوّد",
      delete_confirm: "سيتم حذف المزوّد وإعداداته نهائياً.",
      created: "تمت إضافة المزوّد",
      updated: "تم التحديث",
      deleted: "تم حذف المزوّد",
      models_fetched: "تم جلب النماذج",
      playground: "تجربة النموذج",
      playground_hint: "ابدأ رسالة مع النموذج المحدد.",
      chat_placeholder: "اكتب رسالتك...",
      send: "إرسال",
      sending: "جارٍ الإرسال...",
      reply: "الرد",
      no_models: "لا نماذج متاحة لهذا المزوّد.",
      empty: "لا مزوّدات بعد — أضف أول مزوّد من السحابة أو الاستضافة أو المحلي.",
      save: "حفظ",
      saved: "تم الحفظ",
      cancel: "إلغاء",
      close: "إغلاق",
      busy: "جارٍ المعالجة...",
      no_key: "يجب ضبط مفتاح API لهذا المزوّد.",
      total_tokens: "الرموز",
      duration: "المدة",
      connected: "متصل",
      provided_providers: "مزودي النماذج",
      tab_providers: "المزوّدات",
      tab_analysis: "تحليل الكود",
      analysis_subtitle: "الصق كوداً وحلّله مباشرة عبر محرك التحليل (Go gateway) للحصول على مؤشرات وقواعد فورية.",
      source_label: "الكود",
      source_placeholder: "الصق هنا كود TypeScript أو JavaScript أو Python…",
      language_label: "لغة الكود",
      analyze: "تحليل",
      analyzing: "جارٍ التحليل…",
      gateway_ok: "محرك التحليل متاح",
      gateway_down: "محرك التحليل غير متاح",
      engine_base: "عنوان المحرك",
      engine_version: "الإصدار",
      analysis_failed: "فشل التحليل",
      empty_error: "أدخل كوداً للتحليل أولاً",
    },
    assistant: {
      title: "مساعد المدير",
      subtitle: "اسأل عن أرقام مؤسستك — العضوات، المشاريع، الإجازات، الجداول الزمنية…",
      placeholder: "مثال: كم ساعة سُجّلت هذا الشهر؟",
      ask: "إرسال",
      thinking: "جارٍ التفكير…",
      summary_mode: "ملخص محلي",
      ai_mode: "ذكاء اصطناعي",
      clear: "مسح المحادثة",
      empty: "ابدأ بسؤال عن مؤسستك.",
    },
    ai_actions: {
      title: "إجراءات الذكاء الاصطناعي",
      subtitle: "أتمتة بنقرة واحدة — تحسين Dockerfiles وخطوط الأنابيب، إصلاح مشاكل الفحص، ومراجعة الكود، ثم تطبيق النتائج.",
      refresh: "تحديث",
      tab_actions: "الإجراءات",
      catalog: "الإجراءات المتاحة",
      runs: "السجل",
      empty: "لا توجد عمليات بعد — اختر إجراءً للبدء.",
      no_provider: "لا يوجد مزوّد نماذج نشط. أضِف واحداً من تبويب نماذج الذكاء الاصطناعي أولاً.",
      available: "إجراء (إجراءات) متاحة",
      run: "تشغيل",
      run_action: "تشغيل إجراء ذكاء اصطناعي",
      running: "جارٍ التوليد بالذكاء الاصطناعي...",
      busy: "جارٍ المعالجة...",
      close: "إغلاق",
      back: "رجوع",
      preview: "معاينة",
      apply: "تطبيق التغييرات",
      applied: "تم التطبيق",
      applying: "جارٍ التطبيق...",
      already_applied: "تم تطبيقه مسبقاً",
      apply_error: "تعذّر تطبيق التغييرات",
      advisory: "ناتج الذكاء الاصطناعي استرشادي — راجِع قبل التطبيق.",
      error_title: "فشل التوليد",
      error_subtitle: "فشلت عملية النموذج ولم يتغيّر أي شيء.",
      run_by: "نفّذه",
      provider: "المزوّد",
      model: "النموذج",
      duration: "المدة",
      status: "الحالة",
      status_completed: "مكتمل",
      status_failed: "فشل",
      cancel: "إلغاء",
      action_name: {
        optimize_dockerfile: "مُحسِّن Dockerfile",
        optimize_pipeline: "مُحسِّن خط الأنابيب",
        fix_scan_issues: "إصلاح مشاكل الفحص",
        explain_code: "مراجعة / شرح الكود",
      },
      action_desc: {
        optimize_dockerfile: "تقليل وقت البناء وحجم الصورة، ترتيب الطبقات وتقليل الانتفاخ.",
        optimize_pipeline: "تحسين خطوات البناء: تخزين مؤقت وتوازٍ وأوامر واضحة.",
        fix_scan_issues: "إصلاحات مقترحة بالذكاء الاصطناعي لمشاكل الكود المختارة.",
        explain_code: "شرح منظم لكود مُلصق مع نصائح للتحسين.",
      },
      step_label: "مهمة",
      step_desc: "وصف المهمة",
      repository_label: "المستودع",
      repository_placeholder: "اختر مستودعاً مرتبطاً",
      source_label: "الكود المصدري",
      source_placeholder: "الصق محتوى Dockerfile (أو اختر مستودعاً)",
      pipeline_label: "خط الأنابيب",
      pipeline_placeholder: "اختر خط أنابيب",
      steps_label: "الخطوات",
      steps_placeholder: "الصق الخطوات أو JSON (أو اختر خط أنابيب)",
      issue_count: "{count} مشكلة",
      language_label: "اللغة",
      select_language: "اختر اللغة (اختياري)",
      run_now: "تشغيل الآن",
      no_repositories: "لا توجد مستودعات مرتبطة. الصق المصدر يدوياً أو اربط مستودعاً من تبويب Git.",
      steps_pasted: "الخطوات (مُلصقة)",
      created_tasks: "المهام المنشأة",
      committed_file: "ملف جديد / مُحدَّث",
      steps_applied: "الخطوات المحسّنة مطبَّقة",
      applied_at: "وقت التطبيق",
      used_default: "استخدام النموذج الافتراضي",
    },
    overview: {
      heading: "لوحة التحكم",
      subheading: "نظرة سريعة على مؤسستك",
      quick_scan: "فحص سريع للكود",
      open_projects: "المشاريع",
      open_dev: "تحليل الكود",
      projects_count: "مشاريع",
      issues_count: "مشاكل كود",
      recent_activity: "النشاط الأخير",
    },
    teams: {
      title: "الفرق",
      no_teams: "لا توجد فرق بعد — أنشئ أول فريق",
      create: "إنشاء فريق",
      name: "اسم الفريق",
      description: "الوصف",
      members: "أعضاء",
      add_member: "إضافة عضو",
      no_members: "لا يوجد أعضاء",
      remove: "إزالة",
      owner: "مالك",
      member: "عضو",
      search_placeholder: "البحث في أعضاء المؤسسة…",
      no_candidates: "جميع أعضاء المؤسسة أعضاء بالفعل في هذا الفريق. ادعُ أعضاء جدد من إعدادات المؤسسة.",
    },
    planner: {
      title: "مخطّط السبرنت",
      open: "خطّط من دفتر الشروط",
      subtitle: "حوّل دفتر الشروط إلى قائمة مهام جاهزة للتنفيذ.",
      upload_title: "ارفع دفتر الشروط",
      upload_hint: "PDF أو Word (.docx) أو Markdown أو نص — حتى 20 ميغابايت",
      choose_file: "اختر ملفًا",
      change_file: "تغيير الملف",
      sprint_name: "اسم السبرنت",
      sprint_name_placeholder: "مثال: السبرنت 1 — الإصدار 1.0",
      generate: "توليد قائمة المهام",
      generating: "جارٍ تحليل المستند…",
      preview_title: "قائمة المهام المقترحة",
      document: "المستند",
      tickets_count: "{count} تذكرة",
      epics_count: "{count} ملحمة",
      chars_count: "{count} حرفًا",
      ai_note: "تعذّر الاتصال بالذكاء الاصطناعي، فتم إنشاء قائمة المهام بالاستخراج المدمج. راجع التذاكر قبل التطبيق.",
      no_tickets: "لم يتم العثور على تذاكر في هذا المستند.",
      project: "المشروع",
      select_project: "اختر مشروعًا",
      team: "الفريق (اختياري)",
      no_team: "بدون فريق",
      story_points: "نقاط القصة",
      apply: "إنشاء السبرنت والتذاكر",
      applying: "جارٍ إنشاء التذاكر…",
      success_title: "تم إنشاء السبرنت",
      success_desc: "تم إنشاء {epics} ملحمة و{tasks} تذكرة في «{sprint}».",
      view_board: "عرض اللوحة",
      done: "تم",
      back: "رجوع",
      error: "حدث خطأ ما. حاول مجددًا.",
    },
    messages: {
      title: "الرسائل",
      new_message: "رسالة جديدة",
      new_group: "مجموعة جديدة",
      no_conversations: "لا توجد محادثات بعد — ابدأ أول محادثة",
      type_message: "اكتب رسالة…",
      send: "إرسال",
      members: "أعضاء",
      online: "متصل الآن",
      typing: "يكتب…",
      start_conversation: "ابدأ محادثة",
      start: "ابدأ",
      group_name: "اسم المجموعة",
      select_members: "اختر الأعضاء",
      leave_group: "مغادرة المجموعة",
      add_member: "إضافة عضو",
      inviter: "الدعوات",
      all_members: "جميع الأعضاء",
      emoji: "إيموجي",
      stickers: "ملصقات",
      gifs: "صور متحركة",
      sticker: "ملصق",
      gif: "صورة متحركة",
      gif_search: "ابحث في Giphy…",
      gif_key_hint: "أضف NEXT_PUBLIC_GIPHY_API_KEY لتفعيل البحث عن الصور المتحركة.",
      attachment: "مرفق",
      attachments: "ملفات مشتركة",
      upload_error: "تعذر رفع الملف.",
      status_available: "متاح",
      status_away: "غير متواجد",
      status_busy: "مشغول",
      status_offline: "غير متصل",
      last_seen: "آخر ظهور {time}",
      read: "قُرئت",
      set_status: "تعيين الحالة",
      clear_status: "مسح الحالة",
      add_reaction: "إضافة رد فعل",
      delete_message: "حذف الرسالة",
      deleted_message: "تم حذف هذه الرسالة",
      archive_conversation: "أرشفة المحادثة",
      unarchive_conversation: "إلغاء الأرشفة",
      archived: "مؤرشفة",
      archive_hidden: "المحادثات المؤرشفة",
      open_chat_window: "فتح نافذة الدردشة",
      chat_window_title: "الدردشة",
      call: "مكالمة",
      calling: "جارٍ الاتصال…",
      incoming_call: "مكالمة واردة",
      accept: "قبول",
      decline: "رفض",
      end_call: "إنهاء المكالمة",
      mute_mic: "كتم الميكروفون",
      mute_video: "إيقاف الفيديو",
      call_ended: "انتهت المكالمة",
    },
    invite: {
      title: "دعوة الأعضاء",
      invite: "دعوة",
      email: "البريد الإلكتروني",
      email_placeholder: "example@company.com",
      role: "الدور",
      send_invite: "إرسال الدعوة",
      invites: "الدعوات المرسلة",
      no_invites: "لا توجد دعوات معلقة",
      pending: "قيد الانتظار",
      accepted: "تم قبولها",
      revoked: "تم إلغاؤها",
      revoke: "إلغاء",
      sent: "تم إرسال الدعوة",
      add_existing: "إضافة عضو موجود",
      welcome_title: "مرحبًا بك!",
      welcome_subtitle: "تمت دعوتك للانضمام إلى مؤسسة على TechVerse",
      create_account: "أنشئ حسابك",
      confirm_password: "تأكيد كلمة المرور",
      password_mismatch: "كلمتا المرور غير متطابقتين",
      invalid_token: "رابط الدعوة غير صالح أو منتهي",
      join_org: "انضم إلى المؤسسة",
      already_member: "دعوة صالحة — اضغط للمتابعة",
    },
    servers: {
      title: "الخوادم",
      subtitle: "اربط حالات الخوادم (VPS) وأدر تطبيقاتها المتصلة.",
      new_server: "خادم جديد",
      refresh: "تحديث",
      edit: "تعديل",
      delete: "حذف",
      delete_confirm: "سيتم حذف اتصال الخادم وجميع تطبيقاته نهائياً.",
      name: "الاسم",
      name_placeholder: "مثال: خادم الإنتاج",
      host: "المضيف",
      host_placeholder: "مثال: 203.0.113.10 أو my-server.com",
      port: "المنفذ",
      protocol: "البروتوكول",
      username: "المستخدم",
      username_placeholder: "مثال: deploy",
      credential: "المفتاح أو كلمة المرور",
      credential_placeholder: "أدخل مفتاح SSH أو كلمة مرور",
      credential_configured: "تم ضبط البيانات السرية — اتركها فارغة للإبقاء عليها",
      protocols: {
        ssh: "SSH",
        ftp: "FTP",
        npm: "NPM",
      },
      probe_now: "اختبار الاتصال",
      probing: "جارٍ الاختبار…",
      never_tested: "لم يُختبر بعد",
      reachable: "متاح",
      unreachable: "غير متاح",
      last_probe: "آخر فحص",
      probe_error: "خطأ الفحص",
      probe_note: "الفحص هو فحص وصول (TCP) عبر المضيف والمنفذ فقط — لا يفتح أي جلسة SSH.",
      empty_title: "لا توجد خوادم بعد",
      empty_desc: "اربط أول خادم VPS لديك لإدارة حالة الوصول والتطبيقات المتصلة.",
      created: "تمت إضافة الخادم",
      updated: "تم تحديث الخادم",
      saved: "تم الحفظ",
      deleted: "تم حذف الخادم",
      probe_ok: "الخادم متاح",
      probe_fail: "الخادم غير متاح",
      apps: "التطبيقات المتصلة",
      manage_apps: "إدارة التطبيقات",
      add_app: "إضافة تطبيق",
      app_name: "اسم التطبيق",
      app_name_placeholder: "مثال: لوحة التحكم",
      app_url: "عنوان التطبيق",
      app_url_placeholder: "https://app.example.com",
      probe_path: "مسار الفحص",
      probe_path_placeholder: "مثال: /health",
      probe_method: "طريقة الفحص",
      no_apps: "لا توجد تطبيقات متصلة بعد",
      method_get: "GET",
      method_post: "POST",
      app_ok: "سليم",
      app_fail: "معطّل",
      app_probe_ok: "التطبيق يستجيب بشكل سليم",
      app_probe_fail: "فشل فحص التطبيق",
      checked_at: "آخر فحص",
      app_created: "تمت إضافة التطبيق",
      app_updated: "تم تحديث التطبيق",
      app_deleted: "تم حذف التطبيق",
      role_note: "يمكن للمالكين فقط إنشاء وتعديل وحذف الخوادم وإجراء الفحوصات.",
      cancel: "إلغاء",
      save: "حفظ",
      busy: "جارٍ المعالجة…",
    },
    service: {
      title: "إدارة الخدمات",
      subtitle: "الكتالوج والطلبات والحوادث وماعدة المعرفة مع أهداف SLA",
      overview: "نظرة عامة",
      catalog: "كتالوج الخدمات",
      requests: "الطلبات",
      incidents: "الحوادث",
      knowledge: "قاعدة المعرفة",
      sla: "سياسات SLA",
      my_queue: "قائمة عملي",
      open_tickets: "تذاكر مفتوحة",
      pending_approvals: "بانتظار الموافقة",
      breached_incidents: "حوادث متجاوزة",
      unassigned: "غير مُسندة",
      sla_compliance: "الالتزام بـ SLA",
      avg_resolution: "متوسط زمن الحل",
      avg_response: "متوسط زمن الاستجابة",
      satisfaction: "رضا الطلبات",
      top_items: "الأكثر طلبًا",
      workload: "توزيع الأحمال",
      recent_activity: "آخر النشاطات",
      no_activity: "لا توجد تعليقات بعد",
      hours_unit: "ساعة",
      minutes_unit: "دقيقة",
      new_request: "طلب جديد",
      new_incident: "حادث جديد",
      new_article: "مقال جديد",
      new_item: "خدمة جديدة",
      search_placeholder: "ابحث في التذاكر…",
      filter_all: "الكل",
      filter_mine: "تذاكري",
      filter_unassigned: "غير مُسندة",
      filter_open: "مفتوحة",
      filter_breached: "متجاوزة",
      status: "الحالة",
      priority: "الأولوية",
      requester: "مقدّم الطلب",
      assignee: "المُسند",
      category: "الفئة",
      item: "الخدمة",
      created: "أُنشئت",
      updated: "حُدّثت",
      due: "الاستحقاق",
      target_date: "التاريخ المستهدف",
      no_items: "لا توجد خدمات في الكتالوج",
      no_items_hint: "أضف أول خدمة ليتمكن الموظفون من طلبها",
      no_requests: "لا توجد طلبات",
      no_incidents: "لا توجد حوادث",
      no_articles: "لا توجد مقالات",
      no_articles_hint: "انشر أول مقالة قاعدة معرفة",
      title_field: "العنوان",
      description_field: "الوصف",
      email_field: "البريد الإلكتروني",
      phone_field: "الهاتف",
      name_field: "الاسم",
      priority_p1: "حرجة",
      priority_p2: "عالية",
      priority_p3: "عادية",
      priority_p4: "منخفضة",
      requires_approval: "تحتاج موافقة",
      approval_required_hint: "تمر الطلبات التي تحتاج موافقة على مدير الخدمة قبل التنفيذ",
      estimated_days: "المدة التقديرية (أيام)",
      active: "نشطة",
      inactive: "متوقفة",
      form_fields: "حقول النموذج",
      field_label: "عنوان الحقل",
      field_key: "المفتاح",
      field_type: "النوع",
      field_required: "إلزامي",
      add_field: "إضافة حقل",
      save_item: "حفظ الخدمة",
      request_number: "رقم الطلب",
      decision_note: "ملاحظة القرار",
      approve: "موافقة",
      reject: "رفض",
      start_work: "بدء التنفيذ",
      mark_fulfilled: "تم التنفيذ",
      close_ticket: "إغلاق",
      cancel_ticket: "إلغاء",
      reopen: "إعادة فتح",
      resolve: "حل",
      mark_closed: "إغلاق نهائي",
      rate_request: "قيّم الخدمة",
      rating_thanks: "شكرًا لتقييمك",
      internal_note: "ملاحظة داخلية",
      internal_note_hint: "ملاحظة داخلية لا تظهر لمقدّم الطلب",
      comment_placeholder: "اكتب تعليقًا…",
      send: "إرسال",
      resolution: "الحل",
      root_cause: "السبب الجذري",
      resolution_placeholder: "ما الإجراء الذي تم اتخاذه؟",
      root_cause_placeholder: "ما سبب جذر المشكلة؟",
      respond_target: "هدف الاستجابة",
      resolve_target: "هدف الحل",
      responded_at: "وقت الاستجابة",
      resolved_at: "وقت الحل",
      reopen_count: "مرات إعادة الفتح",
      breached: "متجاوز",
      on_track: "ضمن الهدف",
      business_hours_only: "ساعات العمل فقط",
      sla_save: "حفظ السياسة",
      sla_defaults_hint: "القيم الافتراضية: P1 15د/4س، P2 1س/8س، P3 4س/24س، P4 8س/48س",
      restore_defaults: "استعادة الافتراضي",
      minutes_short: "دقيقة",
      article_published: "منشورة",
      article_draft: "مسودة",
      publish: "نشر",
      unpublish: "إلغاء النشر",
      helpful: "مفيدة",
      not_helpful: "غير مفيدة",
      views: "مشاهدة",
      tags: "الوسوم",
      read_article: "قراءة المقال",
      body_field: "المحتوى",
      summary_field: "ملخص",
      linked_request: "طلب مرتبط",
      detail: "التفاصيل",
      back: "رجوع",
      link_portal: "بوابة العملاء",
      view_catalog: "استعرض الكتالوج",
      view_requests: "استعرض الطلبات",
      view_incidents: "استعرض الحوادث",
      view_knowledge: "تصفح المقالات",
      public_title: "بوابة دعم العملاء",
      public_subtitle: "اطلب خدمة، أبلغ عن مشكلة، أو تابع حالة تذاكرك",
      public_new_request: "طلب خدمة",
      public_report_issue: "الإبلاغ عن مشكلة",
      public_track: "تتبع تذكرة",
      public_track_hint: "أدخل رقم التذكرة والبريد الإلكتروني المستخدم عند إنشائها",
      public_number: "رقم التذكرة",
      public_choose_service: "اختر الخدمة",
      public_priority_hint: "اختر الأولوية حسب تأثير المشكلة",
      public_submit: "إرسال",
      public_submitted: "تم استلام طلبك",
      public_keep_number: "احتفظ برقم التذكرة للمتابعة",
      public_ticket_status: "حالة التذكرة",
      public_ticket_raised: "تاريخ الفتح",
      public_target: "الهدف الزمني",
      public_not_found: "لا توجد تذكرة مطابقة لرقم وبريد مُدخلين",
      public_services: "خدماتنا",
      public_fill_all: "يرجى تعبئة جميع الحقول المطلوبة",
      public_your_email: "بريدك الإلكتروني",
      public_impact: "الأثر",
      public_impact_hint: "اشرح ما الذي يتعطل ومن يتأثر",
      public_wide_impact: "تأثير واسع",
      p1_hint: "الأنظمة متوقفة تمامًا",
      p2_hint: "ميزة أساسية معطلة",
      p3_hint: "خلل جزئي مع حل بديل",
      p4_hint: "استفسار أو طلب بسيط",
    },
    common: {
      cancel: "إلغاء",
      save: "حفظ",
      close: "إغلاق",
      edit: "تعديل",
    },
  },
  en: {
    timesheet: {
      title: "Timesheet",
      subtitle: "Track your weekly working hours",
      week_of: "Week of",
      total_hours: "Total hours",
      day_hours: "Day hours",
      hour_short: "hr",
      save: "Save",
      saving: "Saving…",
      saved: "Saved",
      submit: "Submit",
      submitting: "Submitting…",
      submitted: "Submitted",
      approved: "Approved",
      rejected: "Rejected",
      draft: "Draft",
      error_load: "Failed to load timesheet",
      empty: "No entries for this week",
      hour: "hour",
      hours: "hours",
      add_entry: "Add entry",
      activity: "Activity",
      activity_placeholder: "e.g. built new feature, fixed a bug",
      project: "Project",
      task: "Task",
      select_project: "Select project",
      select_task: "Select task",
      previous: "Previous",
      next: "Next",
      today: "Today",
      history: "History",
      empty_history: "No past entries yet",
      invalid_hours: "Hours must be between 0.5 and 24",
      hours_min: "Min 0.5 hour",
      hours_max: "Max 24 hours",
      export_csv: "Export CSV",
      import_csv: "Import CSV",
      importing: "Importing…",
      import_done: "Imported {imported} of {total} rows",
      import_failed: "Failed to import CSV file",
      day_labels: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      view_month: "Month",
      view_list: "List",
      off_day: "OFF",
    },
    payroll: {
      title: "Payroll",
      subtitle: "Run monthly payroll from approved timesheets",
      no_runs: "No payroll runs yet",
      create_run: "New run",
      create_run_btn: "Create run",
      month_label: "Month",
      month_hint: "YYYY-MM (e.g. 2026-01)",
      currency: "Currency",
      notes: "Notes",
      run_exists: "A payroll run already exists for this month",
      run_created: "Payroll run created",
      history: "Payroll runs",
      status: "Status",
      status_pending: "Pending",
      status_paid: "Paid",
      month: "Month",
      generated: "Generation",
      created_at: "Created",
      employees: "Employees",
      total_hours: "Hours",
      gross_total: "Gross",
      net_total: "Net",
      actions: "Actions",
      generate: "Generate",
      generating: "Generating…",
      generated_ok: "Run generated from timesheets",
      mark_paid: "Mark paid",
      mark_paid_confirm: "Mark this run as paid? This cannot be undone.",
      marked_paid_ok: "Run marked as paid",
      export_csv: "Export CSV",
      export_ok: "CSV downloaded",
      import_csv: "Import CSV",
      import_title: "Import overrides from CSV",
      import_hint: "Columns: member_id (or member_name), rate, bonus",
      upload_csv: "Choose CSV file",
      import_ok: "Imported {applied} override(s)",
      import_errors: "Skipped {skipped} row(s)",
      entries: "Payslips",
      member: "Member",
      hours: "Hours",
      regular: "Regular",
      overtime: "Overtime",
      rate: "Rate",
      bonus: "Bonus",
      gross: "Gross",
      net: "Net",
      override: "Override",
      overrides: "Overrides",
      apply_override: "Apply",
      override_ok: "Override applied",
      no_entries: "No payslips yet — generate the run first",
      generate_first: "Generate the run to compute payslips",
      paid_at: "Paid at",
      busy: "Processing…",
    },
    leave: {
      title: "Leave",
      subtitle: "Manage leave requests and balances",
      types: "Types",
      balances: "Balances",
      requests: "Requests",
      new_request: "New request",
      leave_type: "Leave type",
      select_type: "Select a leave type",
      start_date: "Start date",
      end_date: "End date",
      days: "Days",
      computed_days: "Computed days",
      reason: "Reason",
      reason_placeholder: "Explain the reason for your request…",
      submit: "Submit",
      submitting: "Submitting…",
      submitted: "Submitted",
      cancel: "Cancel",
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      cancelled: "Cancelled",
      error_load: "Failed to load requests",
      empty_requests: "No requests yet",
      request_success: "Request sent successfully",
      error_submit: "Failed to send request",
      no_balances: "No balance available for this type",
      year: "Year",
      granted: "Granted",
      used: "Used",
      carried_over: "Carried over",
      balance_remaining: "Balance remaining",
      my_leave: "My leave",
      approvals: "Approvals",
      approve: "Approve",
      reject: "Reject",
      review_note: "Review note",
      auto_approved: "Approved instantly (no review)",
      needs_approval: "Requires manager approval",
      remaining_after: "Remaining after this request",
      empty_queue: "No pending requests to review",
      approved_success: "Request approved",
      rejected_success: "Request rejected",
      cancelled_success: "Request cancelled",
      no_types: "No active leave types",
      calendar: "Calendar",
      calendar_hint: "Your leave and company off days at a glance",
      upcoming: "Upcoming",
      next_leave: "Next leave",
      no_upcoming: "No upcoming leave",
    },
    leave_settings: {
      title: "Leave Settings",
      subtitle: "Manage leave types and team balances",
      types: "Leave types",
      balances: "Leave balances",
      new_type: "New leave type",
      edit_type: "Edit type",
      name: "Name",
      code: "Code",
      color: "Color",
      is_paid: "Paid leave",
      days_per_year: "Days per year",
      carry_over: "Carry-over days",
      accrual_per_month: "Accrual per month",
      requires_approval: "Requires approval",
      is_active: "Active",
      create: "Create",
      creating: "Creating…",
      saving: "Saving…",
      save_changes: "Save changes",
      empty_types: "No leave types yet — create your first one",
      active: "Active",
      inactive: "Inactive",
      paid: "Paid",
      unpaid: "Unpaid",
      created: "Leave type created",
      updated: "Leave type updated",
      error_load: "Failed to load leave settings",
      error_save: "Failed to save leave type",
      balances_note: "Managers can edit the granted, carried-over, and adjusted amounts for each leave type.",
      no_balances: "No balances for this year",
      balance_updated: "Balance updated",
      granted: "Granted",
      used: "Used",
      pending: "Pending",
      adjusted: "Adjusted",
      carried_over: "Carried over",
      remaining: "Remaining",
      calendar_source: "Holiday calendar",
      calendar_hint: "Choose the public-holiday country and the day the work-week starts — these affect how leave days are counted.",
      manage_holidays: "Manage holidays",
      member: "Member",
      all_members: "All members",
    },
    holidays: {
      title: "Public Holidays",
      subtitle: "Browse public holidays by year",
      year: "Year",
      year_placeholder: "e.g. 2026",
      load: "Load",
      loading: "Loading…",
      holiday: "Holiday",
      holidays: "Holidays",
      month: "Month",
      date: "Date",
      name: "Name",
      local_name: "Local name",
      empty: "No holidays for this year",
      error_load: "Failed to load holidays",
      source_note: "Source: date-holidays (open public-holiday database)",
      country: "Country",
      region: "Region",
      region_placeholder: "All regions",
      defaults_saved: "Organization holiday defaults saved",
      defaults_error: "Failed to save holiday defaults",
      months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      off_day: "Off day",
      mark_off_day: "Set as off day",
      remove_off_day: "Remove from off days",
      off_day_note: "Holidays you set as off days appear as OFF in the team's timesheet.",
      off_days_selected: "{count} selected as off days",
      off_day_toggle_error: "Failed to update off day",
    },
    nav: {
      title: "TechDebt AI",
      subtitle: "Technical Debt Analysis",
      dashboard: "Dashboard",
      scan: "Scan Project",
      git: "Git Integration",
      timesheet: "Timesheet",
      leave: "Leave",
      holidays: "Holidays",
      leave_settings: "Leave settings",
    },
    hero: {
      title: "AI-Powered Technical Debt Analysis",
      description:
        "Get a comprehensive view of your codebase — complexity, security, performance, and maintainability. Supports Arabic, English, and French.",
      analyze_now: "Start Analysis",
    },
    tabs: {
      paste: "Paste Code",
      project: "Scan Project",
      git: "Git Repository",
    },
    paste: {
      title: "Paste Your Code",
      placeholder: "Paste your source code here...",
      language_label: "Source Language",
      languages: { rust: "Rust", typescript: "TypeScript", javascript: "JavaScript", python: "Python", go: "Go", java: "Java", c: "C", ruby: "Ruby", csharp: "C#", cpp: "C++", php: "PHP" },
      analyze: "Analyze",
      analyzing: "Analyzing...",
    },
    project: {
      title: "Scan Project Folder",
      description: "Enter the path to your project directory on this machine",
      path_label: "Folder Path",
      path_placeholder: "e.g. C:\\Users\\you\\project or /home/you/project",
      scan: "Scan",
      scanning: "Scanning...",
      include_ignored: "Include hidden files",
    },
    git: {
      title: "Analyze Git Repository",
      description: "Enter a local Git repo path or repository URL",
      local_tab: "Local Path",
      remote_tab: "Repository URL",
      local_placeholder: "e.g. C:\\Users\\you\\my-repo",
      remote_placeholder: "e.g. https://github.com/user/repo.git",
      analyze: "Analyze",
      analyzing: "Analyzing...",
    },
    results: {
      title: "Analysis Results",
      metrics: "Metrics",
      lines_of_code: "Lines of Code",
      cyclomatic_complexity: "Cyclomatic Complexity",
      maintainainability_index: "Maintainability Index",
      issues_found: "Issues Found",
      rules_triggered: "Rules Triggered",
      no_issues: "No issues — clean code!",
      severity_critical: "Critical",
      severity_high: "High",
      severity_medium: "Medium",
      severity_low: "Low",
      line: "Line",
      suggestion: "Suggestion",
      fix_template: "Fix Template",
      suggestion_copied: "Suggestion copied",
      copy_suggestion: "Copy fix",
      no_suggestion: "No suggested fix",
      severity_info: "Info",
    },
    git_results: {
      branch: "Current Branch",
      last_commit: "Last Commit",
      author: "Author",
      date: "Date",
      remote: "Remote",
      tracked_files: "Tracked Files",
      total_commits: "Total Commits",
      repo_status: "Repository Status",
      clean: "Clean",
      dirty: "Dirty",
    },
    footer: {
      built_with: "Built with",
      rust_go_next: "Rust · Go · Next.js",
    },
    errors: {
      empty_code: "Please enter code to analyze",
      invalid_path: "Invalid path",
      scan_failed: "Scan failed",
      git_failed: "Git analysis failed",
      network_error: "Network error",
      not_found: "Not found",
    },
    auth: {
      login_title: "Sign in",
      register_title: "Create account",
      subtitle: "Arabic-first Unified Collaboration Platform",
      email: "Email",
      password: "Password",
      full_name: "Full name",
      sign_in: "Sign in",
      sign_up: "Sign up",
      submitting: "Submitting...",
      switch_to_register: "No account? Create one",
      switch_to_login: "Have an account? Sign in",
      err_required: "Please fill in all fields",
      err_invalid: "Invalid credentials",
      err_generic: "Could not reach the server",
      basacore_login: "Continue with Basacore",
    },
    platform: {
      overview: "Overview",
      projects: "Projects",
      repositories: "Repositories",
      teams: "Teams",
      messages: "Messages",
      dev: "Code Analysis",
      dev_rules: "Analysis Rules",
      issues: "Issues",
      agent_factory: "AI Agents",
      notifications: "Notifications",
      no_notifications: "No notifications",
admin: "Administration",
      service_desk_section: "Service",
      service_desk: "Service Desk",
      service_requests: "Requests",
      service_incidents: "Incidents",
      service_knowledge: "Knowledge",
      organizations: "Organizations",
      create_org: "Create organization",
      org_name: "Organization name",
      create_org_btn: "Create",
      no_orgs: "No organizations yet",
      create_first_org: "Create your first organization to get started",
      logout: "Sign out",
      welcome: "Welcome",
      cancel: "Cancel",
      close: "Close",
      menu: "Menu",
      search_trigger: "Search",
      new: "New",
      new_project: "New Project",
      new_repository: "New Repository",
      new_message: "New Message",
      workspace: "Workspace",
      engineering: "Engineering",
    timesheet: "Timesheet",
    leave: "Leave",
    holidays: "Holidays",
    leave_settings: "Leave Settings",
    management: "Management",
      profile: "Profile",
      settings: "Settings",
      sign_out: "Sign out",
      collapse: "Collapse sidebar",
      expand: "Expand sidebar",
      mark_all_read: "Mark all as read",
      loading: "Loading…",
      pipelines: "Pipelines",
      new_pipeline: "New Pipeline",
      ai: "AI Models",
      new_ai: "New Provider",
      servers: "Servers",
      payroll: "Payroll",
    },
    search: {
      placeholder: "Search projects, repositories, conversations…",
      navigate: "Navigate",
      conversations: "Conversations",
      switch_org: "Switch organization",
      no_results: "No results",
      hint: "↑ ↓ to navigate · ↵ to select · esc to close",
      recent: "Recent",
    },
    projects: {
      title: "Projects",
      create: "New Project",
      new_project: "Create Project",
      name: "Project name",
      key: "Key",
      type: "Type",
      types: { GENERAL: "General", ENGINEERING: "Engineering", MARKETING: "Marketing", SALES: "Sales", HR: "HR", OTHER: "Other" },
      color: "Color",
      empty: "No projects yet — create your first one",
      view: "Open",
      tasks: "tasks",
      boards: "boards",
      created: "Created",
      all: "All",
      no_match: "No projects match your search or filters.",
    },
    board: {
      add_task: "New Task",
      task_title: "Task title",
      task_placeholder: "e.g. Fix login validation bug",
      priority: "Priority",
      low: "Low",
      medium: "Medium",
      high: "High",
      urgent: "Urgent",
      due: "Due",
    },
    agile: {
      board: "Board",
      backlog: "Backlog",
      sprints: "Sprints",
      team: "Team",
      teams: "Teams",
      all_teams: "All teams",
      no_teams_linked: "No linked teams",
      points: "pts",
      point_estimate: "Story points",
      new_sprint: "New sprint",
      sprint_name: "Sprint name",
      sprint_goal: "Goal",
      start_date: "Start date",
      end_date: "End date",
      create: "Create",
      configure_workflow: "Configure workflow",
      workflow_name: "Workflow name",
      new_column: "New column",
      column_name: "Column name",
      column_status: "Status",
      is_backlog: "Backlog column",
      wip_limit: "WIP limit",
      delete: "Delete",
      start: "Start",
      complete: "Complete",
      cancel: "Cancel",
      planned_sprints: "Planned sprints",
      completed_sprints: "Completed sprints",
      tasks_in_sprint: "Sprint tasks",
      add: "Add",
      search: "Search…",
      details: "Details",
      assignee: "Assignee",
      no_assignee: "Unassigned",
      type: "Type",
      types: { EPIC: "Epic", STORY: "Story", TASK: "Task", BUG: "Bug", SUBTASK: "Sub-task" },
      comments: "Comments",
      no_comments: "No comments",
      comment_placeholder: "Add a comment…",
      read_only: "Read-only — managers can modify",
      epic: "Epic",
      no_epic: "No epic",
      epics_title: "Epics",
      new_epic: "New epic",
      unassigned: "No sprint",
      all_priorities: "All priorities",
      all_types: "All types",
      my_tasks: "My tasks",
      clear: "Clear",
    },
    repo: {
      tab: "Git",
      title: "Git repositories",
      subtitle: "Link repositories, track branches & commits, and run full code scans.",
      link_repository: "Link repository",
      url_label: "Repository URL",
      url_placeholder: "https://github.com/org/repo.git",
      token_label: "Access token (for private repos)",
      token_placeholder: "ghp_… or gitlab PAT — optional",
      name_label: "Display name (optional)",
      connect: "Connect",
      connecting: "Verifying…",
      unlink: "Unlink",
      empty: "No repositories linked to this project yet.",
      branches: "Branches",
      recent_commits: "Recent commits",
      latest_commit: "Latest commit",
      provider: "Provider",
      default_branch: "Default branch",
      size: "Size",
      language: "Language",
      last_sync: "Last synced",
      never: "Never",
      scan: "Scan now",
      scanning: "Scanning…",
      scan_on_push: "Auto-scan on push",
      webhook_url: "Webhook URL",
      copy: "Copy",
      copied: "Copied",
      issues_found: "issues found",
      clean_scan: "No issues",
      status: "Status",
      files: "files",
      lines: "lines",
      issues: "Issues",
      triage: "Create task",
      no_issues: "Run a scan to surface code issues, then turn them into tasks.",
      read_only: "Managers can link and unlink repositories.",
      refresh: "Refresh",
      confirm_unlink: "This repository will be removed from this project. Existing issues will be kept.",
    },
    admin: {
      tab: "Administration",
      subtitle: "Manage access, roles, invitations, and the audit trail across your organization.",
      not_admin: "You need organization admin rights to view this page.",
      back_to_dashboard: "Back to dashboard",
      overview: "Overview",
      members: "Members",
      invites: "Invitations",
      tokens: "Tokens",
      roles: "Roles & permissions",
      audit: "Audit log",
      settings: "Settings",
      stat_members: "Members",
      stat_invites: "Pending invites",
      stat_projects: "Projects",
      stat_audit_events: "Audit events",
      plan: "Plan",
      seats: "Seats",
      member_updated: "Member updated",
      member_removed: "Member removed",
      cannot_remove_owner: "Cannot remove the owner",
      cannot_remove_self: "Cannot remove your own account",
      already_member: "That person is already a member — check invitations",
      member_roles: { OWNER: "Owner", ADMIN: "Admin", MANAGER: "Manager", MEMBER: "Member", VIEWER: "Viewer" },
      save: "Save",
      remove: "Remove",
      title: "Title",
      status: "Status",
      when: "When",
      email: "Email",
      invite_sent: "Invitation sent",
      invite_revoked: "Invitation revoked",
      send_invite: "Send invitation",
      pending: "Pending",
      accepted: "Accepted",
      revoked: "Revoked",
      token_name: "Token name",
      create_token: "Create token",
      created_token: "Token created — copy it now, it won't be shown again",
      copy: "Copy",
      copied: "Copied",
      token_revoked: "Token revoked",
      no_tokens: "No tokens yet",
      last_used: "Last used",
      never: "Never",
      access_intro: "How access is served in your workspace",
      access_list_intro: "Each role grants a distinct set of capabilities — from read-only browsing to full organizational control.",
      nav_sections: "Sections visible per role",
      nav_sections_hint: "What each role sees in the sidebar follows the same permissions the API enforces.",
      audit_intro: "A log of every sensitive action taken inside the organization.",
      no_audit: "No audit events yet",
      all_actions: "All actions",
      settings_intro: "General organization settings and billing preferences.",
      org_name: "Organization name",
      org_slug: "Slug",
      billing_email: "Billing email",
      timezone: "Timezone",
      currency: "Currency",
      locale: "Language",
      holiday_country: "Holiday country",
      holiday_region: "Holiday region",
      work_week_start: "Work week starts on",
      saved: "Saved",
      storage_attachments: "Attachment storage",
      storage_driver: "Storage driver",
      storage_local: "Local disk",
      storage_s3: "S3 / MinIO",
      storage_bucket: "Bucket",
      storage_endpoint: "Endpoint",
      storage_max: "Max upload size",
    },
    githost: {
      title: "Git repositories",
      subtitle: "Self-hosted on the platform — create, clone, push, and pull straight to TechVerse.",
      create: "New repository",
      new_repository: "New repository",
      name: "Name",
      name_placeholder: "e.g. mobile-app",
      description: "Description",
      visibility: "Visibility",
      private: "Private",
      public: "Public",
      init_readme: "Initialize with README",
      link_project: "Link to project (optional)",
      no_project: "No project",
      create_busy: "Creating…",
      empty: "No repositories yet — create one and push to it.",
      default_branch: "Default branch",
      size: "Size",
      files: "Files",
      branches: "Branches",
      commits_title: "Commits",
      files_title: "Files",
      readme: "README",
      latest_commit: "Latest commit",
      clone_url: "Clone URL",
      push_command: "Push commands",
      add_file: "Add file",
      new_file: "New file",
      file_path: "File path",
      file_content: "Content",
      commit_message: "Commit message",
      commit: "Commit",
      committing: "Committing…",
      scan: "Scan now",
      scanning: "Scanning…",
      delete: "Delete repository",
      delete_confirm: "The repository and its on-disk content will be removed permanently.",
      tokens_title: "Access tokens",
      create_token: "Create token",
      new_token: "New access token",
      token_name: "Token name",
      created_token: "Copy it now — you won't see it again!",
      copy: "Copy",
      copied: "Copied",
      revoke: "Revoke",
      no_tokens: "No tokens yet.",
      last_push: "Last push",
      never: "Never",
      visibility_label: "Visibility",
      open_in_editor: "Open in editor",
      languages: "Languages",
      contributors: "Contributors",
      no_commits: "No commits yet",
      no_files: "No files yet",
    },
    dev: {
      title: "Code Analysis",
      subtitle: "Discover technical debt and security issues — powered by the Rust engine",
      analyze: "Analyze",
      pasted: "Issues",
      scans: "Scans",
      no_issues: "No issues — clean code!",
      issues_title: "Detected Issues",
      triage: "Triage to task",
      triaged: "Triaged ✓",
      scan_now: "Analyze now",
      recent_scans: "Recent scans",
      code_health: "Code health",
      complexity: "Complexity",
      maintainability: "Maintainability",
      inline: "Inline",
      all_severities: "All severities",
      all_status: "All statuses",
      open: "Open",
      fixed: "Fixed",
      group_by_file: "Group by file",
      files: "files",
      issues_count: "issues",
      explain: "Explain",
      explaining: "Explaining…",
      explanation: "Explanation",
      fix_suggested: "Fix suggested",
      copy: "Copy",
      copied: "Copied ✓",
      settings: "Analysis settings",
      threshold: "Threshold",
      ignore_rules: "Ignore rules",
      save: "Save",
      saved: "Saved ✓",
      debt_trend: "Technical debt trend",
      no_data: "Not enough data yet",
      mark_fixed: "Mark fixed",
      reopen: "Reopen",
      all_rules: "All rules",
      filter_rule: "Filter by rule",
      open_issues: "Open",
      fixed_issues: "Fixed",
      total_issues: "Total",
      top_rules: "Top rules",
      view_issues: "View issues",
      filter_scan: "Single scan",
      exclude_paths: "Exclude paths",
      include_paths: "Include paths",
      path_hint: "A trailing / means \"contains\", otherwise it is a suffix match — e.g. src/api/ or .ts",
      rules_title: "Analysis Rules",
      rules_subtitle: "Enable or disable the engine's built-in rules. Disabled rules are excluded from every scan.",
      rules_search: "Search",
      rules_search_placeholder: "Search by rule name or id…",
      rules_category: "Category",
      rules_severity: "Severity",
      rules_language: "Language",
      rules_all: "All",
      rules_enabled_only: "Enabled only",
      rules_enabled: "enabled",
      rules_disabled: "disabled",
      rules_total: "Total",
      rules_save: "Save changes",
      rules_saved: "Analysis rules saved",
      rules_reset: "Reset to default",
      rules_reset_confirm: "Reset all rules to their default state?",
      rules_no_results: "No matching rules",
      rules_applies_to: "Applies to",
      rules_runtime_note: "Rules load dynamically from the Rust analysis engine (40 total).",
      rules_metric: "Metric",
      rules_readonly: "You have read-only access — a MEMBER role or higher is required to save changes.",
      issues_search: "Search by file or message…",
      issues_no_match: "No issues match your filters",
      clear_filters: "Clear filters",
    },
    pipeline: {
      title: "CI/CD Pipelines",
      subtitle: "Run checks, builds and deploys directly against your hosted repositories.",
      create: "New pipeline",
      new_pipeline: "New pipeline",
      name: "Name",
      name_placeholder: "e.g. CI: Studio Core",
      description: "Description",
      description_placeholder: "What does this pipeline do? (optional)",
      repository: "Repository",
      repository_placeholder: "Select a repository",
      trigger: "Trigger",
      trigger_manual: "Manual",
      trigger_push: "On push",
      branch: "Branch",
      branch_placeholder: "main",
      steps: "Steps",
      step_name: "Step name",
      step_command: "Command",
      add_step: "Add step",
      remove_step: "Remove",
      create_busy: "Creating...",
      empty: "No pipelines yet — create one or link a repository.",
      run: "Run",
      running: "Running...",
      cancel: "Cancel",
      cancelling: "Cancelling...",
      ran: "Last run",
      status: "Status",
      queued: "Queued",
      success: "Success",
      failed: "Failed",
      cancelled: "Cancelled",
      duration: "Duration",
      runs_title: "Run history",
      no_runs: "No runs yet — trigger the pipeline to get started.",
      runs: "runs",
      never: "Never",
      active: "Active",
      disabled: "Disabled",
      delete: "Delete pipeline",
      delete_confirm: "The pipeline and its run history will be removed permanently.",
      edit: "Edit",
      saved: "Saved",
      run_triggered: "Pipeline triggered",
      run_cancelled: "Run cancelled",
      created: "Pipeline created",
      deleted: "Pipeline deleted",
      triggered_by: "Triggered by",
      branch_label: "Branch",
      repo_label: "Repository",
      steps_label: "Steps",
      last_run: "Last run",
      start: "Start",
      output: "Output",
      command: "Command",
      logs: "Logs",
      back: "Back",
      started: "Started",
      finished: "Finished",
      now: "now",
      seconds: "sec",
    },
    ai: {
      title: "AI Models",
      subtitle: "Connect model providers — cloud, self-hosted, or fully local.",
      new_provider: "New provider",
      create: "Add",
      edit: "Edit",
      name: "Name",
      name_placeholder: "e.g. OpenAI Cloud",
      provider: "Provider",
      provider_placeholder: "Choose a provider",
      provider_type: {
        openai: "OpenAI",
        anthropic: "Anthropic",
        google: "Google Gemini",
        groq: "Groq",
        mistral: "Mistral AI",
        openrouter: "OpenRouter",
        azure: "Azure OpenAI",
        ollama: "Ollama (Local)",
        openai_compatible: "OpenAI-Compatible (Self-hosted)",
      },
      base_url: "Base URL",
      base_url_placeholder: "https://...",
      api_key: "API Key",
      api_key_placeholder: "sk-...",
      api_key_optional: "Optional",
      key_configured: "Key configured",
      models: "Models",
      add_model: "Add model",
      model_placeholder: "e.g. gpt-4o-mini",
      remove: "Remove",
      fetch_models: "Fetch models",
      fetching: "Fetching...",
      default_model: "Default model",
      default_model_placeholder: "Select a model",
      test: "Test connection",
      testing: "Testing...",
      test_ok: "Connection OK",
      test_fail: "Connection failed",
      last_test: "Last test",
      never_tested: "Never tested",
      status: "Status",
      active: "Active",
      disabled: "Disabled",
      enable: "Enable",
      disable: "Disable",
      delete: "Delete provider",
      delete_confirm: "The provider and its settings will be permanently deleted.",
      created: "Provider added",
      updated: "Provider updated",
      deleted: "Provider deleted",
      models_fetched: "Models fetched",
      playground: "Playground",
      playground_hint: "Send a message to the selected model.",
      chat_placeholder: "Type your message...",
      send: "Send",
      sending: "Sending...",
      reply: "Reply",
      no_models: "No models available for this provider.",
      empty: "No providers yet — add your first cloud, hosted or local connection.",
      save: "Save",
      saved: "Saved",
      cancel: "Cancel",
      close: "Close",
      busy: "Working...",
      no_key: "An API key is required for this provider.",
      total_tokens: "Tokens",
      duration: "Duration",
      connected: "Connected",
      provided_providers: "Model providers",
      tab_providers: "Providers",
      tab_analysis: "Code Analysis",
      analysis_subtitle: "Paste code and analyze it instantly through the analysis engine (Go gateway) for metrics and rules.",
      source_label: "Source code",
      source_placeholder: "Paste your TypeScript, JavaScript, Python code here…",
      language_label: "Language",
      analyze: "Analyze",
      analyzing: "Analyzing…",
      gateway_ok: "Analysis engine available",
      gateway_down: "Analysis engine unreachable",
      engine_base: "Engine base URL",
      engine_version: "Engine version",
      analysis_failed: "Analysis failed",
      empty_error: "Enter some code to analyze first",
    },
    assistant: {
      title: "Manager assistant",
      subtitle: "Ask about your organization's numbers — members, projects, leave, timesheets…",
      placeholder: "e.g. How many hours were logged this month?",
      ask: "Send",
      thinking: "Thinking…",
      summary_mode: "Local summary",
      ai_mode: "AI",
      clear: "Clear conversation",
      empty: "Start by asking something about your organization.",
    },
    ai_actions: {
      title: "AI Actions",
      subtitle: "Predefined AI workflows — optimize Dockerfiles and pipelines, fix scan issues, review code, then apply the result.",
      refresh: "Refresh",
      tab_actions: "Actions",
      catalog: "Available actions",
      runs: "History",
      empty: "No runs yet. Pick an action below to get started.",
      no_provider: "No active AI model provider. Add one in the AI Models tab first.",
      available: "action(s) available",
      run: "Run",
      run_action: "Run AI action",
      running: "Generating with AI...",
      busy: "Working...",
      close: "Close",
      back: "Back",
      preview: "Preview",
      apply: "Apply changes",
      applied: "Applied",
      applying: "Applying...",
      already_applied: "Already applied",
      apply_error: "Could not apply changes",
      advisory: "AI output is advisory — review before applying.",
      error_title: "Generation failed",
      error_subtitle: "The model run failed and nothing was changed.",
      run_by: "Run by",
      provider: "Provider",
      model: "Model",
      duration: "Duration",
      status: "Status",
      status_completed: "Completed",
      status_failed: "Failed",
      cancel: "Cancel",
      action_name: {
        optimize_dockerfile: "Dockerfile optimizer",
        optimize_pipeline: "Pipeline optimizer",
        fix_scan_issues: "Fix scan issues",
        explain_code: "Code review / explain",
      },
      action_desc: {
        optimize_dockerfile: "Cut build time and image size, sort layers and reduce bloat.",
        optimize_pipeline: "Improve pipeline steps with caching, parallelization and clear commands.",
        fix_scan_issues: "AI-drafted fixes for the code issues you select.",
        explain_code: "Structured walkthrough of pasted code, with improvement tips.",
      },
      step_label: "Task step",
      step_desc: "Task description",
      repository_label: "Repository",
      repository_placeholder: "Pick a linked repository",
      source_label: "Source code",
      source_placeholder: "Paste the Dockerfile contents (or pick a repository)",
      pipeline_label: "Pipeline",
      pipeline_placeholder: "Pick a pipeline",
      steps_label: "Steps",
      steps_placeholder: "Paste steps or JSON (or pick a pipeline)",
      issue_count: "{count} issue(s)",
      language_label: "Language",
      select_language: "Select language (optional)",
      run_now: "Run now",
      no_repositories: "No linked repositories. Paste source manually or link one in Git.",
      steps_pasted: "Steps (pasted)",
      created_tasks: "Created tasks",
      committed_file: "New / updated file",
      steps_applied: "Optimized steps applied",
      applied_at: "Applied at",
      used_default: "Using default model",
    },
    overview: {
      heading: "Dashboard",
      subheading: "A quick look at your organization",
      quick_scan: "Quick code scan",
      open_projects: "Projects",
      open_dev: "Code Analysis",
      projects_count: "projects",
      issues_count: "code issues",
      recent_activity: "Recent activity",
    },
    teams: {
      title: "Teams",
      no_teams: "No teams yet — create your first team",
      create: "Create Team",
      name: "Team name",
      description: "Description",
      members: "Members",
      add_member: "Add Member",
      no_members: "No members",
      remove: "Remove",
      owner: "Owner",
      member: "Member",
      search_placeholder: "Search organization members…",
      no_candidates: "Every organization member is already part of this team. Invite new members from the organization settings.",
    },
    planner: {
      title: "Sprint planner",
      open: "Plan from a spec",
      subtitle: "Turn a cahier des charges into a backlog that is ready to build.",
      upload_title: "Upload the spec document",
      upload_hint: "PDF, Word (.docx), Markdown or text — up to 20 MB",
      choose_file: "Choose file",
      change_file: "Change file",
      sprint_name: "Sprint name",
      sprint_name_placeholder: "e.g. Sprint 1 — v1.0",
      generate: "Generate backlog",
      generating: "Analyzing document…",
      preview_title: "Proposed backlog",
      document: "Document",
      tickets_count: "{count} tickets",
      epics_count: "{count} epics",
      chars_count: "{count} characters",
      ai_note: "AI was unavailable, so the backlog was drafted with built-in extraction. Review the tickets before applying.",
      no_tickets: "No tickets were found in this document.",
      project: "Project",
      select_project: "Select a project",
      team: "Team (optional)",
      no_team: "No team",
      story_points: "Story points",
      apply: "Create sprint & tickets",
      applying: "Creating tickets…",
      success_title: "Sprint created",
      success_desc: "{epics} epics and {tasks} tickets were created in “{sprint}”.",
      view_board: "View board",
      done: "Done",
      back: "Back",
      error: "Something went wrong. Please try again.",
    },
    messages: {
      title: "Messages",
      new_message: "New message",
      new_group: "New group",
      no_conversations: "No conversations yet — start your first chat",
      type_message: "Type a message…",
      send: "Send",
      members: "Members",
      online: "Online now",
      typing: "typing…",
      start_conversation: "Start a conversation",
      start: "Start",
      group_name: "Group name",
      select_members: "Select members",
      leave_group: "Leave group",
      add_member: "Add member",
      inviter: "Invites",
      all_members: "All members",
      emoji: "Emoji",
      stickers: "Stickers",
      gifs: "GIFs",
      sticker: "Sticker",
      gif: "GIF",
      gif_search: "Search Giphy…",
      gif_key_hint: "Add NEXT_PUBLIC_GIPHY_API_KEY to enable GIF search.",
      attachment: "Attachment",
      attachments: "Shared files",
      upload_error: "Could not upload the file.",
      status_available: "Available",
      status_away: "Away",
      status_busy: "Busy",
      status_offline: "Offline",
      last_seen: "Last seen {time}",
      read: "Read",
      set_status: "Set status",
      clear_status: "Clear status",
      add_reaction: "Add reaction",
      delete_message: "Delete message",
      deleted_message: "This message was deleted",
      archive_conversation: "Archive conversation",
      unarchive_conversation: "Unarchive conversation",
      archived: "Archived",
      archive_hidden: "Archive",
      open_chat_window: "Open chat window",
      chat_window_title: "Chat",
      call: "Call",
      calling: "Calling…",
      incoming_call: "Incoming call",
      accept: "Accept",
      decline: "Decline",
      end_call: "End call",
      mute_mic: "Mute microphone",
      mute_video: "Turn off video",
      call_ended: "Call ended",
    },
    invite: {
      title: "Invite members",
      invite: "Invite",
      email: "Email",
      email_placeholder: "example@company.com",
      role: "Role",
      send_invite: "Send invite",
      invites: "Sent invites",
      no_invites: "No pending invites",
      pending: "Pending",
      accepted: "Accepted",
      revoked: "Revoked",
      revoke: "Revoke",
      sent: "Invite sent",
      add_existing: "Add existing member",
      welcome_title: "Welcome!",
      welcome_subtitle: "You've been invited to join an organization on TechVerse",
      create_account: "Create your account",
      confirm_password: "Confirm password",
      password_mismatch: "Passwords do not match",
      invalid_token: "Invite link is invalid or expired",
      join_org: "Join organization",
      already_member: "Valid invite — click to continue",
    },
    servers: {
      title: "Servers",
      subtitle: "Connect VPS/server hosts and manage their deployed applications.",
      new_server: "New Server",
      refresh: "Refresh",
      edit: "Edit",
      delete: "Delete",
      delete_confirm: "The server connection and all of its apps will be permanently deleted.",
      name: "Name",
      name_placeholder: "e.g. Production Server",
      host: "Host",
      host_placeholder: "e.g. 203.0.113.10 or my-server.com",
      port: "Port",
      protocol: "Protocol",
      username: "Username",
      username_placeholder: "e.g. deploy",
      credential: "Credential (key / password)",
      credential_placeholder: "SSH key or password",
      credential_configured: "Credential configured — leave blank to keep it",
      protocols: {
        ssh: "SSH",
        ftp: "FTP",
        npm: "NPM",
      },
      probe_now: "Test connection",
      probing: "Probing…",
      never_tested: "Never tested",
      reachable: "Reachable",
      unreachable: "Unreachable",
      last_probe: "Last probe",
      probe_error: "Probe error",
      probe_note: "Probing performs a TCP reachability check on host:port only — no SSH session is opened.",
      empty_title: "No servers yet",
      empty_desc: "Connect your first VPS host to track reachability and linked applications.",
      created: "Server added",
      updated: "Server updated",
      saved: "Saved",
      deleted: "Server deleted",
      probe_ok: "Server is reachable",
      probe_fail: "Server is unreachable",
      apps: "Linked Apps",
      manage_apps: "Manage Apps",
      add_app: "Add App",
      app_name: "App name",
      app_name_placeholder: "e.g. Admin Dashboard",
      app_url: "App URL",
      app_url_placeholder: "https://app.example.com",
      probe_path: "Probe path",
      probe_path_placeholder: "e.g. /health",
      probe_method: "Probe method",
      no_apps: "No linked apps yet",
      method_get: "GET",
      method_post: "POST",
      app_ok: "Healthy",
      app_fail: "Down",
      app_probe_ok: "App is responding correctly",
      app_probe_fail: "App probe failed",
      checked_at: "Last checked",
      app_created: "App added",
      app_updated: "App updated",
      app_deleted: "App deleted",
      role_note: "Only organization owners can create, edit, delete or probe servers.",
      cancel: "Cancel",
      save: "Save",
      busy: "Working…",
    },
    service: {
      title: "Service Desk",
      subtitle: "Catalog, requests, incidents and knowledge base with SLA targets",
      overview: "Overview",
      catalog: "Service catalog",
      requests: "Requests",
      incidents: "Incidents",
      knowledge: "Knowledge base",
      sla: "SLA policies",
      my_queue: "My queue",
      open_tickets: "Open tickets",
      pending_approvals: "Pending approvals",
      breached_incidents: "Breached incidents",
      unassigned: "Unassigned",
      sla_compliance: "SLA compliance",
      avg_resolution: "Avg resolution",
      avg_response: "Avg first response",
      satisfaction: "Satisfaction",
      top_items: "Most requested",
      workload: "Workload",
      recent_activity: "Recent activity",
      no_activity: "No comments yet",
      hours_unit: "h",
      minutes_unit: "min",
      new_request: "New request",
      new_incident: "New incident",
      new_article: "New article",
      new_item: "New service",
      search_placeholder: "Search tickets…",
      filter_all: "All",
      filter_mine: "Mine",
      filter_unassigned: "Unassigned",
      filter_open: "Open",
      filter_breached: "Breached",
      status: "Status",
      priority: "Priority",
      requester: "Requester",
      assignee: "Assignee",
      category: "Category",
      item: "Service",
      created: "Created",
      updated: "Updated",
      due: "Due",
      target_date: "Target date",
      no_items: "No services in the catalog",
      no_items_hint: "Add the first service so employees can request it",
      no_requests: "No requests",
      no_incidents: "No incidents",
      no_articles: "No articles",
      no_articles_hint: "Publish the first knowledge base article",
      title_field: "Title",
      description_field: "Description",
      email_field: "Email",
      phone_field: "Phone",
      name_field: "Name",
      priority_p1: "Critical",
      priority_p2: "High",
      priority_p3: "Normal",
      priority_p4: "Low",
      requires_approval: "Requires approval",
      approval_required_hint: "Requests needing approval wait for a service manager before work starts",
      estimated_days: "Estimated days",
      active: "Active",
      inactive: "Inactive",
      form_fields: "Form fields",
      field_label: "Label",
      field_key: "Key",
      field_type: "Type",
      field_required: "Required",
      add_field: "Add field",
      save_item: "Save service",
      request_number: "Request number",
      decision_note: "Decision note",
      approve: "Approve",
      reject: "Reject",
      start_work: "Start work",
      mark_fulfilled: "Mark fulfilled",
      close_ticket: "Close",
      cancel_ticket: "Cancel",
      reopen: "Reopen",
      resolve: "Resolve",
      mark_closed: "Close permanently",
      rate_request: "Rate this service",
      rating_thanks: "Thanks for the feedback",
      internal_note: "Internal note",
      internal_note_hint: "Internal notes are never shown to the requester",
      comment_placeholder: "Write a comment…",
      send: "Send",
      resolution: "Resolution",
      root_cause: "Root cause",
      resolution_placeholder: "What action resolved it?",
      root_cause_placeholder: "What caused the problem?",
      respond_target: "Response target",
      resolve_target: "Resolution target",
      responded_at: "First response",
      resolved_at: "Resolved",
      reopen_count: "Reopens",
      breached: "Breached",
      on_track: "On track",
      business_hours_only: "Business hours only",
      sla_save: "Save policy",
      sla_defaults_hint: "Defaults: P1 15m/4h, P2 1h/8h, P3 4h/24h, P4 8h/48h",
      restore_defaults: "Restore defaults",
      minutes_short: "min",
      article_published: "Published",
      article_draft: "Draft",
      publish: "Publish",
      unpublish: "Unpublish",
      helpful: "Helpful",
      not_helpful: "Not helpful",
      views: "views",
      tags: "Tags",
      read_article: "Read article",
      body_field: "Content",
      summary_field: "Summary",
      linked_request: "Linked request",
      detail: "Details",
      back: "Back",
      link_portal: "Customer portal",
      view_catalog: "Browse the catalog",
      view_requests: "Browse requests",
      view_incidents: "Browse incidents",
      view_knowledge: "Read articles",
      public_title: "Customer support portal",
      public_subtitle: "Request a service, report a problem, or track an existing ticket",
      public_new_request: "Request a service",
      public_report_issue: "Report a problem",
      public_track: "Track a ticket",
      public_track_hint: "Enter the ticket number and the email used when it was raised",
      public_number: "Ticket number",
      public_choose_service: "Choose a service",
      public_priority_hint: "Pick the priority that matches the impact",
      public_submit: "Submit",
      public_submitted: "We received your request",
      public_keep_number: "Keep this number to follow up",
      public_ticket_status: "Ticket status",
      public_ticket_raised: "Raised",
      public_target: "Target",
      public_not_found: "No ticket matches that number and email",
      public_services: "Our services",
      public_fill_all: "Please fill in all required fields",
      public_your_email: "Your email",
      public_impact: "Impact",
      public_impact_hint: "Explain what is broken and who is affected",
      public_wide_impact: "Wide impact",
      p1_hint: "Systems are fully down",
      p2_hint: "Core feature unavailable",
      p3_hint: "Partial failure with a workaround",
      p4_hint: "Simple question or request",
    },
    common: {
      cancel: "Cancel",
      save: "Save",
      close: "Close",
      edit: "Edit",
    },
  },
  fr: {
    timesheet: {
      title: "Feuille de temps",
      subtitle: "Suivez vos heures de travail hebdomadaires",
      week_of: "Semaine du",
      total_hours: "Total heures",
      day_hours: "Heures par jour",
      hour_short: "h",
      save: "Enregistrer",
      saving: "Enregistrement…",
      saved: "Enregistré",
      submit: "Soumettre",
      submitting: "Soumission…",
      submitted: "Soumis",
      approved: "Approuvé",
      rejected: "Rejeté",
      draft: "Brouillon",
      error_load: "Échec du chargement de la feuille de temps",
      empty: "Aucune entrée pour cette semaine",
      hour: "heure",
      hours: "heures",
      add_entry: "Ajouter une entrée",
      activity: "Activité",
      activity_placeholder: "ex. développement d'une fonctionnalité, correction d'un bug",
      project: "Projet",
      task: "Tâche",
      select_project: "Choisir un projet",
      select_task: "Choisir une tâche",
      previous: "Précédent",
      next: "Suivant",
      today: "Aujourd'hui",
      history: "Historique",
      empty_history: "Aucune entrée antérieure",
      invalid_hours: "Les heures doivent être comprises entre 0,5 et 24",
      hours_min: "Min 0,5 heure",
      hours_max: "Max 24 heures",
      export_csv: "Exporter CSV",
      import_csv: "Importer CSV",
      importing: "Importation…",
      import_done: "{imported} ligne(s) importée(s) sur {total}",
      import_failed: "Échec de l'importation du fichier CSV",
      day_labels: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"],
      view_month: "Mois",
      view_list: "Liste",
      off_day: "FÉRIÉ",
    },
    payroll: {
      title: "Paie",
      subtitle: "Gérez la paie mensuelle à partir des feuilles de temps approuvées",
      no_runs: "Aucune campagne de paie",
      create_run: "Nouvelle campagne",
      create_run_btn: "Créer la campagne",
      month_label: "Mois",
      month_hint: "AAAA-MM (ex : 2026-01)",
      currency: "Devise",
      notes: "Notes",
      run_exists: "Une campagne de paie existe déjà pour ce mois",
      run_created: "Campagne de paie créée",
      history: "Campagnes de paie",
      status: "Statut",
      status_pending: "En attente",
      status_paid: "Payée",
      month: "Mois",
      generated: "Génération",
      created_at: "Créé le",
      employees: "Employés",
      total_hours: "Heures",
      gross_total: "Brut",
      net_total: "Net",
      actions: "Actions",
      generate: "Générer",
      generating: "Génération…",
      generated_ok: "Campagne générée à partir des feuilles de temps",
      mark_paid: "Marquer payée",
      mark_paid_confirm: "Marquer cette campagne comme payée ? Action irréversible.",
      marked_paid_ok: "Campagne marquée comme payée",
      export_csv: "Exporter CSV",
      export_ok: "CSV téléchargé",
      import_csv: "Importer CSV",
      import_title: "Importer les ajustements depuis un CSV",
      import_hint: "Colonnes : member_id (ou member_name), rate, bonus",
      upload_csv: "Choisir le fichier CSV",
      import_ok: "{applied} ajustement(s) importé(s)",
      import_errors: "{skipped} ligne(s) ignorée(s)",
      entries: "Bulletins",
      member: "Employé",
      hours: "Heures",
      regular: "Normales",
      overtime: "Supplémentaires",
      rate: "Taux",
      bonus: "Prime",
      gross: "Brut",
      net: "Net",
      override: "Ajustement",
      overrides: "Ajustements",
      apply_override: "Appliquer",
      override_ok: "Ajustement appliqué",
      no_entries: "Aucun bulletin — générez d'abord la campagne",
      generate_first: "Générez la campagne pour calculer les bulletins",
      paid_at: "Payée le",
      busy: "Traitement…",
    },
    leave: {
      title: "Congés",
      subtitle: "Gérez vos demandes de congés et soldes",
      types: "Types",
      balances: "Soldes",
      requests: "Demandes",
      new_request: "Nouvelle demande",
      leave_type: "Type de congé",
      select_type: "Choisir un type de congé",
      start_date: "Date de début",
      end_date: "Date de fin",
      days: "Jours",
      computed_days: "Jours calculés",
      reason: "Motif",
      reason_placeholder: "Expliquez le motif de votre demande...",
      submit: "Envoyer",
      submitting: "Envoi…",
      submitted: "Envoyé",
      cancel: "Annuler",
      pending: "En attente",
      approved: "Approuvé",
      rejected: "Rejeté",
      cancelled: "Annulé",
      error_load: "Échec du chargement des demandes",
      empty_requests: "Aucune demande",
      request_success: "Demande envoyée avec succès",
      error_submit: "Échec de l'envoi de la demande",
      no_balances: "Aucun solde pour ce type",
      year: "Année",
      granted: "Accordés",
      used: "Utilisés",
      carried_over: "Reportés",
      balance_remaining: "Solde restant",
      my_leave: "Mes congés",
      approvals: "Approbations",
      approve: "Approuver",
      reject: "Rejeter",
      review_note: "Note de révision",
      auto_approved: "Approuvé automatiquement (sans révision)",
      needs_approval: "Nécessite l'approbation d'un manager",
      remaining_after: "Restant après cette demande",
      empty_queue: "Aucune demande en attente d'approbation",
      approved_success: "Demande approuvée",
      rejected_success: "Demande rejetée",
      cancelled_success: "Demande annulée",
      no_types: "Aucun type de congé actif",
      calendar: "Calendrier",
      calendar_hint: "Vos congés et les jours fériés de l'entreprise en un coup d'œil",
      upcoming: "À venir",
      next_leave: "Prochain congé",
      no_upcoming: "Aucun congé à venir",
    },
    leave_settings: {
      title: "Paramètres des congés",
      subtitle: "Gérez les types de congé et les soldes de l'équipe",
      types: "Types de congé",
      balances: "Soldes de congé",
      new_type: "Nouveau type de congé",
      edit_type: "Modifier le type",
      name: "Nom",
      code: "Code",
      color: "Couleur",
      is_paid: "Congé payé",
      days_per_year: "Jours par an",
      carry_over: "Jours reportés",
      accrual_per_month: "Acquisition par mois",
      requires_approval: "Approbation requise",
      is_active: "Actif",
      create: "Créer",
      creating: "Création…",
      saving: "Enregistrement…",
      save_changes: "Enregistrer les modifications",
      empty_types: "Aucun type de congé — créez-en un premier",
      active: "Actif",
      inactive: "Inactif",
      paid: "Payé",
      unpaid: "Non payé",
      created: "Type de congé créé",
      updated: "Type de congé mis à jour",
      error_load: "Échec du chargement des paramètres de congés",
      error_save: "Échec de l'enregistrement du type de congé",
      balances_note: "Les gestionnaires peuvent modifier les soldes accordés, reportés et ajustés pour chaque type de congé.",
      no_balances: "Aucun solde pour cette année",
      balance_updated: "Solde mis à jour",
      granted: "Accordés",
      used: "Utilisés",
      pending: "En attente",
      adjusted: "Ajustés",
      carried_over: "Reportés",
      remaining: "Restant",
        calendar_source: "Calendrier des jours fériés",
        calendar_hint: "Choisissez le pays des jours fériés et le jour de début de la semaine de travail — ils influencent le calcul des jours de congé.",
        manage_holidays: "Gérer les jours fériés",
        member: "Membre",
        all_members: "Tous les membres",
    },
    holidays: {
      title: "Jours fériés",
      subtitle: "Parcourez les jours fériés par année",
      year: "Année",
      year_placeholder: "ex. 2026",
      load: "Charger",
      loading: "Chargement…",
      holiday: "Jour férié",
      holidays: "Jours fériés",
      month: "Mois",
      date: "Date",
      name: "Nom",
      local_name: "Nom local",
      empty: "Aucun jour férié pour cette année",
      error_load: "Échec du chargement des jours fériés",
      source_note: "Source : date-holidays (base de données ouverte des jours fériés)",
      country: "Pays",
      region: "Région",
      region_placeholder: "Toutes les régions",
      defaults_saved: "Paramètres de jours fériés de l'organisation enregistrés",
      defaults_error: "Échec de l'enregistrement des paramètres",
      months: ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
      off_day: "Jour férié",
      mark_off_day: "Marquer comme jour férié",
      remove_off_day: "Retirer des jours fériés",
      off_day_note: "Les jours fériés que vous marquez comme fériés apparaissent comme FÉRIÉ dans la feuille de temps de l'équipe.",
      off_days_selected: "{count} sélectionné(s) comme jours fériés",
      off_day_toggle_error: "Échec de la mise à jour du jour férié",
    },
    nav: {
      title: "TechDebt AI",
      subtitle: "Analyse de Dette Technique",
      dashboard: "Tableau de Bord",
      scan: "Scanner le Projet",
      git: "Intégration Git",
      timesheet: "Feuille de temps",
      leave: "Congés",
      holidays: "Jours fériés",
      leave_settings: "Paramètres des congés",
    },
    hero: {
      title: "Analyse de Dette Technique par IA",
      description:
        "Obtenez une vue complète de votre code — complexité, sécurité, performance et maintenabilité. Supporte l'arabe, l'anglais et le français.",
      analyze_now: "Commencer l'Analyse",
    },
    tabs: {
      paste: "Coller le Code",
      project: "Scanner le Projet",
      git: "Dépôt Git",
    },
    paste: {
      title: "Collez Votre Code",
      placeholder: "Collez votre code source ici...",
      language_label: "Langage Source",
      languages: { rust: "Rust", typescript: "TypeScript", javascript: "JavaScript", python: "Python", go: "Go", java: "Java", c: "C", ruby: "Ruby", csharp: "C#", cpp: "C++", php: "PHP" },
      analyze: "Analyser",
      analyzing: "Analyse en cours...",
    },
    project: {
      title: "Scanner un Dossier Projet",
      description: "Entrez le chemin du répertoire du projet sur cette machine",
      path_label: "Chemin du Dossier",
      path_placeholder: "ex: C:\\Users\\vous\\projet ou /home/vous/projet",
      scan: "Scanner",
      scanning: "Scan en cours...",
      include_ignored: "Inclure les fichiers cachés",
    },
    git: {
      title: "Analyser un Dépôt Git",
      description: "Entrez un chemin local ou une URL de dépôt Git",
      local_tab: "Chemin Local",
      remote_tab: "URL du Dépôt",
      local_placeholder: "ex: C:\\Users\\vous\\mon-depot",
      remote_placeholder: "ex: https://github.com/user/repo.git",
      analyze: "Analyser",
      analyzing: "Analyse en cours...",
    },
    results: {
      title: "Résultats de l'Analyse",
      metrics: "Métriques",
      lines_of_code: "Lignes de Code",
      cyclomatic_complexity: "Complexité Cyclomatique",
      maintainainability_index: "Indice de Maintenabilité",
      issues_found: "Problèmes Détectés",
      rules_triggered: "Règles Déclenchées",
      no_issues: "Aucun problème — code propre!",
      severity_critical: "Critique",
      severity_high: "Élevé",
      severity_medium: "Moyen",
      severity_low: "Faible",
      line: "Ligne",
      suggestion: "Suggestion",
      fix_template: "Modèle de Correction",
      suggestion_copied: "Suggestion copiée",
      copy_suggestion: "Copier la correction",
      no_suggestion: "Aucune correction suggérée",
      severity_info: "Info",
    },
    git_results: {
      branch: "Branche Actuelle",
      last_commit: "Dernier Commit",
      author: "Auteur",
      date: "Date",
      remote: "Distant",
      tracked_files: "Fichiers Suivis",
      total_commits: "Total des Commits",
      repo_status: "État du Dépôt",
      clean: "Propre",
      dirty: "Modifié",
    },
    footer: {
      built_with: "Fait avec",
      rust_go_next: "Rust · Go · Next.js",
    },
    errors: {
      empty_code: "Veuillez entrer du code à analyser",
      invalid_path: "Chemin invalide",
      scan_failed: "Échec du scan",
      git_failed: "Échec de l'analyse Git",
      network_error: "Erreur réseau",
      not_found: "Introuvable",
    },
    auth: {
      login_title: "Connexion",
      register_title: "Créer un compte",
      subtitle: "Plateforme de Collaboration Unifiée — arabe d'abord",
      email: "E-mail",
      password: "Mot de passe",
      full_name: "Nom complet",
      sign_in: "Connexion",
      sign_up: "S'inscrire",
      submitting: "Envoi...",
      switch_to_register: "Pas de compte ? Créez-en un",
      switch_to_login: "Déjà un compte ? Connectez-vous",
      err_required: "Veuillez remplir tous les champs",
      err_invalid: "Identifiants invalides",
      err_generic: "Impossible de joindre le serveur",
      basacore_login: "Continuer avec Basacore",
    },
    platform: {
      overview: "Aperçu",
      projects: "Projets",
      repositories: "Dépôts",
      teams: "Équipes",
      messages: "Messages",
      dev: "Analyse de Code",
      dev_rules: "Règles d'Analyse",
      issues: "Problèmes",
      agent_factory: "Agents IA",
      notifications: "Notifications",
      no_notifications: "Aucune notification",
admin: "Administration",
      service_desk_section: "Service",
      service_desk: "Service Desk",
      service_requests: "Demandes",
      service_incidents: "Incidents",
      service_knowledge: "Base de connaissances",
      organizations: "Organisations",
      create_org: "Créer une organisation",
      org_name: "Nom de l'organisation",
      create_org_btn: "Créer",
      no_orgs: "Aucune organisation",
      create_first_org: "Créez votre première organisation pour commencer",
      logout: "Déconnexion",
      welcome: "Bienvenue",
      cancel: "Annuler",
      close: "Fermer",
      menu: "Menu",
      search_trigger: "Rechercher",
      new: "Nouveau",
      new_project: "Nouveau Projet",
      new_repository: "Nouveau Dépôt",
      new_message: "Nouveau Message",
      workspace: "Espace de travail",
      engineering: "Ingénierie",
    timesheet: "Feuille de temps",
    leave: "Congés",
    holidays: "Jours fériés",
    leave_settings: "Paramètres des congés",
    management: "Gestion",
      profile: "Profil",
      settings: "Paramètres",
      sign_out: "Déconnexion",
      collapse: "Réduire",
      expand: "Développer",
      mark_all_read: "Tout marquer comme lu",
      loading: "Chargement…",
      pipelines: "Pipelines",
      new_pipeline: "Nouveau Pipeline",
      ai: "Modèles IA",
      new_ai: "Nouveau Fournisseur",
      servers: "Serveurs",
      payroll: "Paie",
    },
    search: {
      placeholder: "Rechercher projets, dépôts, conversations…",
      navigate: "Naviguer",
      conversations: "Conversations",
      switch_org: "Changer d'organisation",
      no_results: "Aucun résultat",
      hint: "↑ ↓ pour naviguer · ↵ pour sélectionner · esc pour fermer",
      recent: "Récents",
    },
    projects: {
      title: "Projets",
      create: "Nouveau Projet",
      new_project: "Créer un Projet",
      name: "Nom du projet",
      key: "Clé",
      type: "Type",
      types: { GENERAL: "Général", ENGINEERING: "Ingénierie", MARKETING: "Marketing", SALES: "Ventes", HR: "RH", OTHER: "Autre" },
      color: "Couleur",
      empty: "Aucun projet — créez votre premier projet",
      view: "Ouvrir",
      tasks: "tâches",
      boards: "tableaux",
      created: "Créé",
      all: "Tous",
      no_match: "Aucun projet ne correspond à votre recherche ou à vos filtres.",
    },
    board: {
      add_task: "Nouvelle Tâche",
      task_title: "Titre de la tâche",
      task_placeholder: "ex: Corriger le bug de connexion",
      priority: "Priorité",
      low: "Faible",
      medium: "Moyenne",
      high: "Élevée",
      urgent: "Urgente",
      due: "Échéance",
    },
    agile: {
      board: "Tableau",
      backlog: "Backlog",
      sprints: "Sprints",
      team: "Équipe",
      teams: "Équipes",
      all_teams: "Toutes les équipes",
      no_teams_linked: "Aucune équipe liée",
      points: "pts",
      point_estimate: "Points d'histoire",
      new_sprint: "Nouveau sprint",
      sprint_name: "Nom du sprint",
      sprint_goal: "Objectif",
      start_date: "Date de début",
      end_date: "Date de fin",
      create: "Créer",
      configure_workflow: "Configurer le workflow",
      workflow_name: "Nom du workflow",
      new_column: "Nouvelle colonne",
      column_name: "Nom de la colonne",
      column_status: "Statut",
      is_backlog: "Colonne de backlog",
      wip_limit: "Limite WIP",
      delete: "Supprimer",
      start: "Démarrer",
      complete: "Terminer",
      cancel: "Annuler",
      planned_sprints: "Sprints planifiés",
      completed_sprints: "Sprints terminés",
      tasks_in_sprint: "Tâches du sprint",
      add: "Ajouter",
      search: "Rechercher…",
      details: "Détails",
      assignee: "Assigné à",
      no_assignee: "Non assigné",
      type: "Type",
      types: { EPIC: "Epic", STORY: "Story", TASK: "Tâche", BUG: "Bug", SUBTASK: "Sous-tâche" },
      comments: "Commentaires",
      no_comments: "Aucun commentaire",
      comment_placeholder: "Ajouter un commentaire…",
      read_only: "Lecture seule — les managers peuvent modifier",
      epic: "Epic",
      no_epic: "Sans epic",
      epics_title: "Epics",
      new_epic: "Nouveau epic",
      unassigned: "Sans sprint",
      all_priorities: "Toutes les priorités",
      all_types: "Tous les types",
      my_tasks: "Mes tâches",
      clear: "Effacer",
    },
    repo: {
      tab: "Git",
      title: "Dépôts Git",
      subtitle: "Reliez des dépôts, suivez branches et commits, et lancez des analyses complètes.",
      link_repository: "Relier un dépôt",
      url_label: "URL du dépôt",
      url_placeholder: "https://github.com/org/repo.git",
      token_label: "Token d'accès (dépôts privés)",
      token_placeholder: "ghp_… ou PAT GitLab — optionnel",
      name_label: "Nom affiché (optionnel)",
      connect: "Connecter",
      connecting: "Vérification…",
      unlink: "Dissocier",
      empty: "Aucun dépôt relié à ce projet pour l'instant.",
      branches: "Branches",
      recent_commits: "Commits récents",
      latest_commit: "Dernier commit",
      provider: "Fournisseur",
      default_branch: "Branche par défaut",
      size: "Taille",
      language: "Langage",
      last_sync: "Dernière synchro",
      never: "Jamais",
      scan: "Analyser",
      scanning: "Analyse en cours…",
      scan_on_push: "Analyse auto à chaque push",
      webhook_url: "URL du webhook",
      copy: "Copier",
      copied: "Copié",
      issues_found: "problèmes détectés",
      clean_scan: "Aucun problème",
      status: "Statut",
      files: "fichiers",
      lines: "lignes",
      issues: "Problèmes",
      triage: "Créer une tâche",
      no_issues: "Lancez une analyse pour détecter les problèmes et les transformer en tâches.",
      read_only: "Les gestionnaires peuvent relier/dissocier les dépôts.",
      refresh: "Actualiser",
      confirm_unlink: "Ce dépôt sera retiré de ce projet. Les problèmes existants seront conservés.",
    },
    admin: {
      tab: "Administration",
      subtitle: "Gérez l'accès, les rôles, les invitations et la piste d'audit de votre organisation.",
      not_admin: "Vous devez avoir des droits d'administration sur l'organisation pour voir cette page.",
      back_to_dashboard: "Retour au tableau de bord",
      overview: "Vue d'ensemble",
      members: "Membres",
      invites: "Invitations",
      tokens: "Jetons",
      roles: "Rôles & permissions",
      audit: "Journal d'audit",
      settings: "Paramètres",
      stat_members: "Membres",
      stat_invites: "Invitations en attente",
      stat_projects: "Projets",
      stat_audit_events: "Événements d'audit",
      plan: "Formule",
      seats: "Sièges",
      member_updated: "Membre mis à jour",
      member_removed: "Membre supprimé",
      cannot_remove_owner: "Impossible de supprimer le propriétaire",
      cannot_remove_self: "Impossible de supprimer votre propre compte",
      already_member: "Cette personne est déjà membre — vérifiez les invitations",
      member_roles: { OWNER: "Propriétaire", ADMIN: "Admin", MANAGER: "Gestionnaire", MEMBER: "Membre", VIEWER: "Observateur" },
      save: "Enregistrer",
      remove: "Supprimer",
      title: "Titre",
      status: "Statut",
      when: "Quand",
      email: "E-mail",
      invite_sent: "Invitation envoyée",
      invite_revoked: "Invitation révoquée",
      send_invite: "Envoyer une invitation",
      pending: "En attente",
      accepted: "Acceptée",
      revoked: "Révoquée",
      token_name: "Nom du jeton",
      create_token: "Créer un jeton",
      created_token: "Jeton créé — copiez-le maintenant, il ne sera plus affiché",
      copy: "Copier",
      copied: "Copié",
      token_revoked: "Jeton révoqué",
      no_tokens: "Aucun jeton pour le moment",
      last_used: "Dernière utilisation",
      never: "Jamais",
      access_intro: "Comment l'accès est géré dans votre espace de travail",
      access_list_intro: "Chaque rôle accorde un ensemble distinct de capacités — de la lecture seule au contrôle total de l'organisation.",
      nav_sections: "Sections visibles par rôle",
      nav_sections_hint: "Ce que chaque rôle voit dans la barre latérale suit les permissions appliquées par l'API.",
      audit_intro: "Un journal de chaque action sensible effectuée dans l'organisation.",
      no_audit: "Aucun événement d'audit",
      all_actions: "Toutes les actions",
      settings_intro: "Paramètres généraux de l'organisation et préférences de facturation.",
      org_name: "Nom de l'organisation",
      org_slug: "Identifiant",
      billing_email: "E-mail de facturation",
      timezone: "Fuseau horaire",
      currency: "Devise",
      locale: "Langue",
      holiday_country: "Pays des jours fériés",
      holiday_region: "Région des jours fériés",
      work_week_start: "La semaine de travail commence le",
      saved: "Enregistré",
      storage_attachments: "Stockage des pièces jointes",
      storage_driver: "Pilote de stockage",
      storage_local: "Disque local",
      storage_s3: "S3 / MinIO",
      storage_bucket: "Bucket",
      storage_endpoint: "Point de terminaison",
      storage_max: "Taille max de téléversement",
    },
    githost: {
      title: "Dépôts Git",
      subtitle: "Hébergé sur la plateforme — créez, clonez, poussez et tirez directement vers TechVerse.",
      create: "Nouveau dépôt",
      new_repository: "Nouveau dépôt",
      name: "Nom",
      name_placeholder: "ex : mobile-app",
      description: "Description",
      visibility: "Visibilité",
      private: "Privé",
      public: "Public",
      init_readme: "Initialiser avec un README",
      link_project: "Lier à un projet (optionnel)",
      no_project: "Aucun projet",
      create_busy: "Création…",
      empty: "Aucun dépôt pour l'instant — créez-en un et poussez-y.",
      default_branch: "Branche par défaut",
      size: "Taille",
      files: "Fichiers",
      branches: "Branches",
      commits_title: "Commits",
      files_title: "Fichiers",
      readme: "README",
      latest_commit: "Dernier commit",
      clone_url: "URL de clonage",
      push_command: "Commandes de push",
      add_file: "Ajouter un fichier",
      new_file: "Nouveau fichier",
      file_path: "Chemin du fichier",
      file_content: "Contenu",
      commit_message: "Message du commit",
      commit: "Commiter",
      committing: "Validation…",
      scan: "Analyser",
      scanning: "Analyse en cours…",
      delete: "Supprimer le dépôt",
      delete_confirm: "Le dépôt et son contenu sur disque seront supprimés définitivement.",
      tokens_title: "Jetons d'accès",
      create_token: "Créer un jeton",
      new_token: "Nouveau jeton d'accès",
      token_name: "Nom du jeton",
      created_token: "Copiez-le maintenant — il ne sera plus affiché !",
      copy: "Copier",
      copied: "Copié",
      revoke: "Révoquer",
      no_tokens: "Aucun jeton pour l'instant.",
      last_push: "Dernier push",
      never: "Jamais",
      visibility_label: "Visibilité",
      open_in_editor: "Ouvrir dans l'éditeur",
      languages: "Langages",
      contributors: "Contributeurs",
      no_commits: "Aucun commit pour le moment",
      no_files: "Aucun fichier",
    },
    dev: {
      title: "Analyse de Code",
      subtitle: "Découvrez la dette technique et les problèmes de sécurité — moteur Rust",
      analyze: "Analyser",
      pasted: "Problèmes",
      scans: "Analyses",
      no_issues: "Aucun problème — code propre!",
      issues_title: "Problèmes Détectés",
      triage: "Transformer en tâche",
      triaged: "Transformé ✓",
      scan_now: "Analyser maintenant",
      recent_scans: "Analyses récentes",
      code_health: "Santé du code",
      complexity: "Complexité",
      maintainability: "Maintenabilité",
      inline: "En ligne",
      all_severities: "Toutes les gravités",
      all_status: "Tous les statuts",
      open: "Ouvertes",
      fixed: "Corrigées",
      group_by_file: "Grouper par fichier",
      files: "fichiers",
      issues_count: "problèmes",
      explain: "Expliquer",
      explaining: "Explication…",
      explanation: "Explication",
      fix_suggested: "Correctif suggéré",
      copy: "Copier",
      copied: "Copié ✓",
      settings: "Paramètres d'analyse",
      threshold: "Seuil",
      ignore_rules: "Règles ignorées",
      save: "Enregistrer",
      saved: "Enregistré ✓",
      debt_trend: "Tendance de la dette technique",
      no_data: "Pas encore assez de données",
      mark_fixed: "Marquer corrigé",
      reopen: "Rouvrir",
      all_rules: "Toutes les règles",
      filter_rule: "Filtrer par règle",
      open_issues: "Ouverts",
      fixed_issues: "Corrigés",
      total_issues: "Total",
      top_rules: "Règles principales",
      view_issues: "Voir les problèmes",
      filter_scan: "Scan unique",
      exclude_paths: "Chemins exclus",
      include_paths: "Chemins inclus",
      path_hint: "Un / final signifie « contient », sinon correspondance par suffixe — ex. src/api/ ou .ts",
      rules_title: "Règles d'Analyse",
      rules_subtitle: "Activez ou désactivez les règles intégrées du moteur. Les règles désactivées sont exclues de chaque analyse.",
      rules_search: "Rechercher",
      rules_search_placeholder: "Rechercher par nom ou identifiant…",
      rules_category: "Catégorie",
      rules_severity: "Sévérité",
      rules_language: "Langage",
      rules_all: "Tout",
      rules_enabled_only: "Activées uniquement",
      rules_enabled: "activées",
      rules_disabled: "désactivées",
      rules_total: "Total",
      rules_save: "Enregistrer",
      rules_saved: "Règles d'analyse enregistrées",
      rules_reset: "Rétablir les valeurs par défaut",
      rules_reset_confirm: "Réinitialiser toutes les règles à leur état par défaut ?",
      rules_no_results: "Aucune règle correspondante",
      rules_applies_to: "S'applique à",
      rules_runtime_note: "Les règles sont chargées dynamiquement depuis le moteur Rust.",
      rules_metric: "Mesure",
      rules_readonly: "Vous êtes en lecture seule — un rôle MEMBER ou plus est requis pour enregistrer.",
      issues_search: "Rechercher par fichier ou message…",
      issues_no_match: "Aucun problème ne correspond à vos filtres",
      clear_filters: "Effacer les filtres",
    },
    pipeline: {
      title: "Pipelines CI/CD",
      subtitle: "Exécutez tests, builds et déploiements directement sur vos dépôts hébergés.",
      create: "Nouveau pipeline",
      new_pipeline: "Nouveau pipeline",
      name: "Nom",
      name_placeholder: "ex. CI : Studio Core",
      description: "Description",
      description_placeholder: "Que fait ce pipeline ? (optionnel)",
      repository: "Dépôt",
      repository_placeholder: "Sélectionner un dépôt",
      trigger: "Déclencheur",
      trigger_manual: "Manuel",
      trigger_push: "Au push",
      branch: "Branche",
      branch_placeholder: "main",
      steps: "Étapes",
      step_name: "Nom de l'étape",
      step_command: "Commande",
      add_step: "Ajouter une étape",
      remove_step: "Retirer",
      create_busy: "Création...",
      empty: "Aucun pipeline pour l'instant — créez-en un ou reliez un dépôt.",
      run: "Exécuter",
      running: "En cours...",
      cancel: "Annuler",
      cancelling: "Annulation...",
      ran: "Dernière exécution",
      status: "Statut",
      queued: "En attente",
      success: "Succès",
      failed: "Échec",
      cancelled: "Annulé",
      duration: "Durée",
      runs_title: "Historique des exécutions",
      no_runs: "Aucune exécution pour l'instant — déclenchez le pipeline.",
      runs: "exécutions",
      never: "Jamais",
      active: "Actif",
      disabled: "Désactivé",
      delete: "Supprimer le pipeline",
      delete_confirm: "Le pipeline et son historique d'exécutions seront supprimés définitivement.",
      edit: "Modifier",
      saved: "Enregistré",
      run_triggered: "Pipeline déclenché",
      run_cancelled: "Exécution annulée",
      created: "Pipeline créé",
      deleted: "Pipeline supprimé",
      triggered_by: "Déclenché par",
      branch_label: "Branche",
      repo_label: "Dépôt",
      steps_label: "Étapes",
      last_run: "Dernière exécution",
      start: "Démarrer",
      output: "Sortie",
      command: "Commande",
      logs: "Journaux",
      back: "Retour",
      started: "Démarré",
      finished: "Terminé",
      now: "maintenant",
      seconds: "sec",
    },
    ai: {
      title: "Modèles IA",
      subtitle: "Connectez vos fournisseurs de modèles — cloud, auto-hébergé ou 100% local.",
      new_provider: "Nouveau fournisseur",
      create: "Ajouter",
      edit: "Modifier",
      name: "Nom",
      name_placeholder: "ex. OpenAI Cloud",
      provider: "Fournisseur",
      provider_placeholder: "Choisir un fournisseur",
      provider_type: {
        openai: "OpenAI",
        anthropic: "Anthropic",
        google: "Google Gemini",
        groq: "Groq",
        mistral: "Mistral AI",
        openrouter: "OpenRouter",
        azure: "Azure OpenAI",
        ollama: "Ollama (Local)",
        openai_compatible: "Compatible OpenAI (Auto-hébergé)",
      },
      base_url: "URL de base",
      base_url_placeholder: "https://...",
      api_key: "Clé API",
      api_key_placeholder: "sk-...",
      api_key_optional: "Optionnel",
      key_configured: "Clé configurée",
      models: "Modèles",
      add_model: "Ajouter un modèle",
      model_placeholder: "ex. gpt-4o-mini",
      remove: "Retirer",
      fetch_models: "Récupérer les modèles",
      fetching: "Récupération...",
      default_model: "Modèle par défaut",
      default_model_placeholder: "Sélectionner un modèle",
      test: "Tester la connexion",
      testing: "Test en cours...",
      test_ok: "Connexion réussie",
      test_fail: "Échec de la connexion",
      last_test: "Dernier test",
      never_tested: "Jamais testé",
      status: "Statut",
      active: "Actif",
      disabled: "Désactivé",
      enable: "Activer",
      disable: "Désactiver",
      delete: "Supprimer le fournisseur",
      delete_confirm: "Le fournisseur et ses paramètres seront définitivement supprimés.",
      created: "Fournisseur ajouté",
      updated: "Fournisseur mis à jour",
      deleted: "Fournisseur supprimé",
      models_fetched: "Modèles récupérés",
      playground: "Playground",
      playground_hint: "Envoyez un message au modèle sélectionné.",
      chat_placeholder: "Tapez votre message...",
      send: "Envoyer",
      sending: "Envoi...",
      reply: "Réponse",
      no_models: "Aucun modèle disponible pour ce fournisseur.",
      empty: "Aucun fournisseur — ajoutez votre première connexion cloud, hébergée ou locale.",
      save: "Enregistrer",
      saved: "Enregistré",
      cancel: "Annuler",
      close: "Fermer",
      busy: "Traitement...",
      no_key: "Une clé API est requise pour ce fournisseur.",
      total_tokens: "Jetons",
      duration: "Durée",
      connected: "Connecté",
      provided_providers: "Fournisseurs de modèles",
      tab_providers: "Fournisseurs",
      tab_analysis: "Analyse de code",
      analysis_subtitle: "Collez du code et analysez-le instantanément via le moteur d'analyse (passerelle Go) pour obtenir des métriques et des règles.",
      source_label: "Code source",
      source_placeholder: "Collez votre code TypeScript, JavaScript, Python ici…",
      language_label: "Langage",
      analyze: "Analyser",
      analyzing: "Analyse en cours…",
      gateway_ok: "Moteur d'analyse disponible",
      gateway_down: "Moteur d'analyse injoignable",
      engine_base: "URL du moteur",
      engine_version: "Version du moteur",
      analysis_failed: "Échec de l'analyse",
      empty_error: "Entrez d'abord du code à analyser",
    },
    assistant: {
      title: "Assistant de direction",
      subtitle: "Interrogez les chiffres de votre organisation — membres, projets, congés, timesheets…",
      placeholder: "ex. Combien d'heures ce mois-ci ?",
      ask: "Envoyer",
      thinking: "Réflexion…",
      summary_mode: "Résumé local",
      ai_mode: "IA",
      clear: "Effacer la conversation",
      empty: "Commencez par une question sur votre organisation.",
    },
    ai_actions: {
      title: "Actions IA",
      subtitle: "Des workflows IA prédéfinis — optimisez les Dockerfiles et les pipelines, corrigez les problèmes de scan, relisez du code, puis appliquez le résultat.",
      refresh: "Actualiser",
      tab_actions: "Actions",
      catalog: "Actions disponibles",
      runs: "Historique",
      empty: "Aucune exécution pour l'instant. Choisissez une action pour commencer.",
      no_provider: "Aucun fournisseur de modèles actif. Ajoutez-en un dans l'onglet Modèles IA d'abord.",
      available: "action(s) disponible(s)",
      run: "Lancer",
      run_action: "Lancer une action IA",
      running: "Génération par IA en cours...",
      busy: "Traitement en cours...",
      close: "Fermer",
      back: "Retour",
      preview: "Aperçu",
      apply: "Appliquer les modifications",
      applied: "Appliqué",
      applying: "Application en cours...",
      already_applied: "Déjà appliqué",
      apply_error: "Impossible d'appliquer les modifications",
      advisory: "Le résultat de l'IA est indicatif — relisez-le avant d'appliquer.",
      error_title: "Échec de la génération",
      error_subtitle: "L'exécution du modèle a échoué et rien n'a été modifié.",
      run_by: "Lancé par",
      provider: "Fournisseur",
      model: "Modèle",
      duration: "Durée",
      status: "Statut",
      status_completed: "Terminé",
      status_failed: "Échec",
      cancel: "Annuler",
      action_name: {
        optimize_dockerfile: "Optimiseur de Dockerfile",
        optimize_pipeline: "Optimiseur de pipeline",
        fix_scan_issues: "Corriger les problèmes de scan",
        explain_code: "Revue / explication de code",
      },
      action_desc: {
        optimize_dockerfile: "Réduit le temps de build et la taille de l'image, trie les couches et évite le superflu.",
        optimize_pipeline: "Améliore les étapes du pipeline : cache, parallélisation et commandes claires.",
        fix_scan_issues: "Corrections proposées par l'IA pour les problèmes de code sélectionnés.",
        explain_code: "Explication structurée d'un code collé, avec conseils d'amélioration.",
      },
      step_label: "Étape de la tâche",
      step_desc: "Description de la tâche",
      repository_label: "Dépôt",
      repository_placeholder: "Choisir un dépôt lié",
      source_label: "Code source",
      source_placeholder: "Collez le contenu du Dockerfile (ou choisissez un dépôt)",
      pipeline_label: "Pipeline",
      pipeline_placeholder: "Choisir un pipeline",
      steps_label: "Étapes",
      steps_placeholder: "Collez les étapes ou du JSON (ou choisissez un pipeline)",
      issue_count: "{count} problème(s)",
      language_label: "Langage",
      select_language: "Choisir le langage (optionnel)",
      run_now: "Lancer maintenant",
      no_repositories: "Aucun dépôt lié. Collez le source manuellement ou liez un dépôt dans l'onglet Git.",
      steps_pasted: "Étapes (collées)",
      created_tasks: "Tâches créées",
      committed_file: "Fichier nouveau / mis à jour",
      steps_applied: "Étapes optimisées appliquées",
      applied_at: "Appliqué le",
      used_default: "Utilisation du modèle par défaut",
    },
    overview: {
      heading: "Tableau de bord",
      subheading: "Un aperçu rapide de votre organisation",
      quick_scan: "Analyse rapide du code",
      open_projects: "Projets",
      open_dev: "Analyse de Code",
      projects_count: "projets",
      issues_count: "problèmes de code",
      recent_activity: "Activité récente",
    },
    teams: {
      title: "Équipes",
      no_teams: "Aucune équipe — créez votre première équipe",
      create: "Créer une équipe",
      name: "Nom de l'équipe",
      description: "Description",
      members: "Membres",
      add_member: "Ajouter un membre",
      no_members: "Aucun membre",
      remove: "Retirer",
      owner: "Propriétaire",
      member: "Membre",
      search_placeholder: "Rechercher des membres…",
      no_candidates: "Tous les membres de l'organisation font déjà partie de cette équipe. Invitez de nouveaux membres depuis les paramètres.",
    },
    planner: {
      title: "Planificateur de sprint",
      open: "Planifier depuis un cahier des charges",
      subtitle: "Transformez un cahier des charges en backlog prêt à être développé.",
      upload_title: "Importer le cahier des charges",
      upload_hint: "PDF, Word (.docx), Markdown ou texte — jusqu'à 20 Mo",
      choose_file: "Choisir un fichier",
      change_file: "Changer de fichier",
      sprint_name: "Nom du sprint",
      sprint_name_placeholder: "ex. Sprint 1 — v1.0",
      generate: "Générer le backlog",
      generating: "Analyse du document…",
      preview_title: "Backlog proposé",
      document: "Document",
      tickets_count: "{count} tickets",
      epics_count: "{count} épopées",
      chars_count: "{count} caractères",
      ai_note: "L'IA étant indisponible, le backlog a été rédigé par extraction intégrée. Vérifiez les tickets avant d'appliquer.",
      no_tickets: "Aucun ticket n'a été trouvé dans ce document.",
      project: "Projet",
      select_project: "Sélectionner un projet",
      team: "Équipe (facultatif)",
      no_team: "Aucune équipe",
      story_points: "Points de story",
      apply: "Créer le sprint et les tickets",
      applying: "Création des tickets…",
      success_title: "Sprint créé",
      success_desc: "{epics} épopées et {tasks} tickets ont été créés dans « {sprint} ».",
      view_board: "Voir le tableau",
      done: "Terminer",
      back: "Retour",
      error: "Une erreur est survenue. Veuillez réessayer.",
    },
    messages: {
      title: "Messages",
      new_message: "Nouveau message",
      new_group: "Nouveau groupe",
      no_conversations: "Aucune conversation — démarrez votre premier chat",
      type_message: "Écrivez un message…",
      send: "Envoyer",
      members: "Membres",
      online: "En ligne",
      typing: "écrit…",
      start_conversation: "Démarrer une conversation",
      start: "Démarrer",
      group_name: "Nom du groupe",
      select_members: "Sélectionnez les membres",
      leave_group: "Quitter le groupe",
      add_member: "Ajouter un membre",
      inviter: "Invitations",
      all_members: "Tous les membres",
      emoji: "Émoji",
      stickers: "Autocollants",
      gifs: "GIF",
      sticker: "Autocollant",
      gif: "GIF",
      gif_search: "Rechercher sur Giphy…",
      gif_key_hint: "Ajoutez NEXT_PUBLIC_GIPHY_API_KEY pour activer la recherche de GIF.",
      attachment: "Pièce jointe",
      attachments: "Fichiers partagés",
      upload_error: "Impossible de téléverser le fichier.",
      status_available: "Disponible",
      status_away: "Absent",
      status_busy: "Occupé",
      status_offline: "Hors ligne",
      last_seen: "Vu {time}",
      read: "Lu",
      set_status: "Définir le statut",
      clear_status: "Effacer le statut",
      add_reaction: "Ajouter une réaction",
      delete_message: "Supprimer le message",
      deleted_message: "Ce message a été supprimé",
      archive_conversation: "Archiver la conversation",
      unarchive_conversation: "Désarchiver la conversation",
      archived: "Archivée",
      archive_hidden: "Archive",
      open_chat_window: "Ouvrir la fenêtre de discussion",
      chat_window_title: "Discussion",
      call: "Appel",
      calling: "Appel en cours…",
      incoming_call: "Appel entrant",
      accept: "Accepter",
      decline: "Refuser",
      end_call: "Raccrocher",
      mute_mic: "Couper le micro",
      mute_video: "Désactiver la vidéo",
      call_ended: "Appel terminé",
    },
    invite: {
      title: "Inviter des membres",
      invite: "Inviter",
      email: "E-mail",
      email_placeholder: "exemple@entreprise.com",
      role: "Rôle",
      send_invite: "Envoyer l'invitation",
      invites: "Invitations envoyées",
      no_invites: "Aucune invitation en attente",
      pending: "En attente",
      accepted: "Acceptée",
      revoked: "Révoquée",
      revoke: "Révoquer",
      sent: "Invitation envoyée",
      add_existing: "Ajouter un membre existant",
      welcome_title: "Bienvenue !",
      welcome_subtitle: "Vous avez été invité à rejoindre une organisation sur TechVerse",
      create_account: "Créez votre compte",
      confirm_password: "Confirmez le mot de passe",
      password_mismatch: "Les mots de passe ne correspondent pas",
      invalid_token: "Le lien d'invitation est invalide ou expiré",
      join_org: "Rejoindre l'organisation",
      already_member: "Invitation valide — cliquez pour continuer",
    },
    servers: {
      title: "Serveurs",
      subtitle: "Connectez des hôtes VPS/serveurs et gérez leurs applications déployées.",
      new_server: "Nouveau serveur",
      refresh: "Actualiser",
      edit: "Modifier",
      delete: "Supprimer",
      delete_confirm: "La connexion serveur et toutes ses applications seront définitivement supprimées.",
      name: "Nom",
      name_placeholder: "ex. Serveur de production",
      host: "Hôte",
      host_placeholder: "ex. 203.0.113.10 ou my-server.com",
      port: "Port",
      protocol: "Protocole",
      username: "Utilisateur",
      username_placeholder: "ex. deploy",
      credential: "Identifiant (clé / mot de passe)",
      credential_placeholder: "Clé SSH ou mot de passe",
      credential_configured: "Identifiant configuré — laissez vide pour le conserver",
      protocols: {
        ssh: "SSH",
        ftp: "FTP",
        npm: "NPM",
      },
      probe_now: "Tester la connexion",
      probing: "Test en cours…",
      never_tested: "Jamais testé",
      reachable: "Accessible",
      unreachable: "Inaccessible",
      last_probe: "Dernier test",
      probe_error: "Erreur du test",
      probe_note: "Le test n'effectue qu'une vérification d'accessibilité TCP sur hôte:port — aucune session SSH n'est ouverte.",
      empty_title: "Aucun serveur",
      empty_desc: "Connectez votre premier hôte VPS pour suivre son accessibilité et ses applications liées.",
      created: "Serveur ajouté",
      updated: "Serveur mis à jour",
      saved: "Enregistré",
      deleted: "Serveur supprimé",
      probe_ok: "Le serveur est accessible",
      probe_fail: "Le serveur est inaccessible",
      apps: "Applications liées",
      manage_apps: "Gérer les applications",
      add_app: "Ajouter une application",
      app_name: "Nom de l'application",
      app_name_placeholder: "ex. Tableau de bord admin",
      app_url: "URL de l'application",
      app_url_placeholder: "https://app.example.com",
      probe_path: "Chemin du test",
      probe_path_placeholder: "ex. /health",
      probe_method: "Méthode du test",
      no_apps: "Aucune application liée",
      method_get: "GET",
      method_post: "POST",
      app_ok: "Sain",
      app_fail: "En panne",
      app_probe_ok: "L'application répond correctement",
      app_probe_fail: "Le test de l'application a échoué",
      checked_at: "Dernière vérification",
      app_created: "Application ajoutée",
      app_updated: "Application mise à jour",
      app_deleted: "Application supprimée",
      role_note: "Seuls les propriétaires de l'organisation peuvent créer, modifier, supprimer ou tester les serveurs.",
      cancel: "Annuler",
      save: "Enregistrer",
      busy: "Traitement…",
    },
    service: {
      title: "Service Desk",
      subtitle: "Catalogue, demandes, incidents et base de connaissances avec objectifs SLA",
      overview: "Vue d'ensemble",
      catalog: "Catalogue des services",
      requests: "Demandes",
      incidents: "Incidents",
      knowledge: "Base de connaissances",
      sla: "Politiques SLA",
      my_queue: "Ma file",
      open_tickets: "Tickets ouverts",
      pending_approvals: "En attente de validation",
      breached_incidents: "Incidents hors délai",
      unassigned: "Non assignés",
      sla_compliance: "Respect du SLA",
      avg_resolution: "Résolution moyenne",
      avg_response: "Première réponse moyenne",
      satisfaction: "Satisfaction",
      top_items: "Les plus demandés",
      workload: "Charge de travail",
      recent_activity: "Activité récente",
      no_activity: "Aucun commentaire",
      hours_unit: "h",
      minutes_unit: "min",
      new_request: "Nouvelle demande",
      new_incident: "Nouvel incident",
      new_article: "Nouvel article",
      new_item: "Nouveau service",
      search_placeholder: "Rechercher des tickets…",
      filter_all: "Tous",
      filter_mine: "Mes tickets",
      filter_unassigned: "Non assignés",
      filter_open: "Ouverts",
      filter_breached: "Hors délai",
      status: "Statut",
      priority: "Priorité",
      requester: "Demandeur",
      assignee: "Assigné à",
      category: "Catégorie",
      item: "Service",
      created: "Créé",
      updated: "Mis à jour",
      due: "Échéance",
      target_date: "Date cible",
      no_items: "Aucun service dans le catalogue",
      no_items_hint: "Ajoutez un premier service pour que les collaborateurs puissent le demander",
      no_requests: "Aucune demande",
      no_incidents: "Aucun incident",
      no_articles: "Aucun article",
      no_articles_hint: "Publiez le premier article de la base de connaissances",
      title_field: "Titre",
      description_field: "Description",
      email_field: "E-mail",
      phone_field: "Téléphone",
      name_field: "Nom",
      priority_p1: "Critique",
      priority_p2: "Haute",
      priority_p3: "Normale",
      priority_p4: "Basse",
      requires_approval: "Validation requise",
      approval_required_hint: "Les demandes à valider attendent un responsable avant le démarrage",
      estimated_days: "Délai estimé (jours)",
      active: "Actif",
      inactive: "Inactif",
      form_fields: "Champs du formulaire",
      field_label: "Libellé",
      field_key: "Clé",
      field_type: "Type",
      field_required: "Obligatoire",
      add_field: "Ajouter un champ",
      save_item: "Enregistrer le service",
      request_number: "Numéro de demande",
      decision_note: "Note de décision",
      approve: "Approuver",
      reject: "Refuser",
      start_work: "Démarrer",
      mark_fulfilled: "Marquer comme exécuté",
      close_ticket: "Fermer",
      cancel_ticket: "Annuler",
      reopen: "Rouvrir",
      resolve: "Résoudre",
      mark_closed: "Clôturer définitivement",
      rate_request: "Évaluer le service",
      rating_thanks: "Merci pour votre retour",
      internal_note: "Note interne",
      internal_note_hint: "Les notes internes ne sont jamais visibles par le demandeur",
      comment_placeholder: "Écrire un commentaire…",
      send: "Envoyer",
      resolution: "Résolution",
      root_cause: "Cause racine",
      resolution_placeholder: "Quelle action a résolu le problème ?",
      root_cause_placeholder: "Qu'est-ce qui a provoqué le problème ?",
      respond_target: "Objectif de réponse",
      resolve_target: "Objectif de résolution",
      responded_at: "Première réponse",
      resolved_at: "Résolu",
      reopen_count: "Réouvertures",
      breached: "Hors délai",
      on_track: "Dans les temps",
      business_hours_only: "Heures ouvrées uniquement",
      sla_save: "Enregistrer la politique",
      sla_defaults_hint: "Par défaut : P1 15min/4h, P2 1h/8h, P3 4h/24h, P4 8h/48h",
      restore_defaults: "Restaurer les défauts",
      minutes_short: "min",
      article_published: "Publié",
      article_draft: "Brouillon",
      publish: "Publier",
      unpublish: "Dépublier",
      helpful: "Utile",
      not_helpful: "Pas utile",
      views: "vues",
      tags: "Étiquettes",
      read_article: "Lire l'article",
      body_field: "Contenu",
      summary_field: "Résumé",
      linked_request: "Demande liée",
      detail: "Détails",
      back: "Retour",
      link_portal: "Portail client",
      view_catalog: "Parcourir le catalogue",
      view_requests: "Parcourir les demandes",
      view_incidents: "Parcourir les incidents",
      view_knowledge: "Lire les articles",
      public_title: "Portail d'assistance client",
      public_subtitle: "Demandez un service, signalez un problème ou suivez votre ticket",
      public_new_request: "Demander un service",
      public_report_issue: "Signaler un problème",
      public_track: "Suivre un ticket",
      public_track_hint: "Saisissez le numéro du ticket et l'e-mail utilisé à sa création",
      public_number: "Numéro de ticket",
      public_choose_service: "Choisissez un service",
      public_priority_hint: "Choisissez la priorité selon l'impact",
      public_submit: "Envoyer",
      public_submitted: "Nous avons bien reçu votre demande",
      public_keep_number: "Conservez ce numéro pour le suivi",
      public_ticket_status: "Statut du ticket",
      public_ticket_raised: "Créé le",
      public_target: "Objectif",
      public_not_found: "Aucun ticket ne correspond à ce numéro et cet e-mail",
      public_services: "Nos services",
      public_fill_all: "Merci de remplir tous les champs obligatoires",
      public_your_email: "Votre e-mail",
      public_impact: "Impact",
      public_impact_hint: "Expliquez ce qui est cassé et qui est touché",
      public_wide_impact: "Impact large",
      p1_hint: "Les systèmes sont totalement indisponibles",
      p2_hint: "Fonctionnalité principale indisponible",
      p3_hint: "Panne partielle avec solution de contournement",
      p4_hint: "Question ou demande simple",
    },
    common: {
      cancel: "Annuler",
      save: "Enregistrer",
      close: "Fermer",
      edit: "Modifier",
    },
  },
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale]
}
