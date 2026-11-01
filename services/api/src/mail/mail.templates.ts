export type MailTemplate =
  | "invite"
  | "welcome"
  | "task_assigned"
  | "task_comment"
  | "scan_complete"

export interface MailVariables {
  organization?: string
  name?: string
  actionUrl?: string
  actionLabel?: string
  preview?: string
  details?: string
  detailsLabel?: string
  locale?: string
}

function translate(template: MailTemplate, locale: string | undefined, key: string): string {
  if (locale === "ar") {
    const ar: Record<string, string> = {
      invite_title: "لقد دُعيت للانضمام",
      invite_body: "لقد تمت دعوتك للانضمام إلى هذه المؤسسة على منصة TechVerse.",
      invite_cta: "قبول الدعوة",
      welcome_title: "مرحباً في TechVerse",
      welcome_body: "تم إنشاء حسابك بنجاح.",
      assigned_title: "تم إسناد مهمة جديدة إليك",
      assigned_body: "تم إسناد مهمة جديدة إليك. افتحها لتعرف التفاصيل.",
      assigned_cta: "فتح المهمة",
      comment_title: "تعليق جديد على مهمتك",
      comment_body: "أضاف أحد زملائك تعليقاً على مهمة تتابعها.",
      comment_cta: "عرض التعليق",
      scan_title: "اكتمل تحليل الكود",
      scan_body: "انتهى الفحص لحملة كود. راجع النتائج والملاحظات.",
      scan_cta: "عرض النتائج",
      footer: "أنت تتلقى هذه الرسالة من منصة TechVerse.",
    }
    return ar[key] ?? key
  }
  if (locale === "fr") {
    const fr: Record<string, string> = {
      invite_title: "Vous avez été invité à rejoindre",
      invite_body: "Vous avez été invité à rejoindre cette organisation sur TechVerse.",
      invite_cta: "Accepter l'invitation",
      welcome_title: "Bienvenue sur TechVerse",
      welcome_body: "Votre compte a été créé avec succès.",
      assigned_title: "Nouvelle tâche assignée",
      assigned_body: "Une nouvelle tâche vous a été assignée. Ouvrez-la pour voir les détails.",
      assigned_cta: "Ouvrir la tâche",
      comment_title: "Nouveau commentaire sur votre tâche",
      comment_body: "Un collègue a commenté une tâche que vous suivez.",
      comment_cta: "Voir le commentaire",
      scan_title: "Analyse de code terminée",
      scan_body: "L'analyse du code source est terminée. Consultez les résultats.",
      scan_cta: "Voir les résultats",
      footer: "Vous recevez cet e-mail de la plateforme TechVerse.",
    }
    return fr[key] ?? key
  }
  const en: Record<string, string> = {
    invite_title: "You're invited to join",
    invite_body: "You've been invited to join this organization on TechVerse.",
    invite_cta: "Accept Invite",
    welcome_title: "Welcome to TechVerse",
    welcome_body: "Your account has been created successfully.",
    assigned_title: "A new task was assigned to you",
    assigned_body: "A new task has been assigned to you. Open it to see the details.",
    assigned_cta: "Open Task",
    comment_title: "New comment on your task",
    comment_body: "A teammate commented on a task you follow.",
    comment_cta: "View Comment",
    scan_title: "Code analysis complete",
    scan_body: "Your code scan has finished. Review the results and findings.",
    scan_cta: "View Results",
    footer: "You are receiving this email from the TechVerse platform.",
  }
  return en[key] ?? key
}

export function renderMail(template: MailTemplate, vars: MailVariables): { subject: string; html: string } {
  const locale = vars.locale ?? "en"
  const T = (key: string) => translate(template, locale, key)
  const org = vars.organization ?? "TechVerse"
  const name = vars.name ?? ""
  const greeting = locale === "ar" ? `مرحباً${name ? `، ${name}` : ""}` : locale === "fr" ? `Bonjour${name ? ` ${name}` : ""}` : `Hello${name ? ` ${name}` : ""}`

  let title = T(`${template}_title`.replace("_", "_"))
  const titleByTemplate: Record<MailTemplate, string> = {
    invite: T("invite_title"),
    welcome: T("welcome_title"),
    task_assigned: T("assigned_title"),
    task_comment: T("comment_title"),
    scan_complete: T("scan_title"),
  }
  title = titleByTemplate[template]

  const bodyByTemplate: Record<MailTemplate, [string, string?, string?, string?]> = {
    invite: [T("invite_body"), org, T("invite_cta"), vars.actionUrl],
    welcome: [T("welcome_body"), undefined, "TechVerse", vars.actionUrl],
    task_assigned: [T("assigned_body"), vars.details, T("assigned_cta"), vars.actionUrl],
    task_comment: [T("comment_body"), vars.details, T("comment_cta"), vars.actionUrl],
    scan_complete: [T("scan_body"), vars.details, T("scan_cta"), vars.actionUrl],
  }
  const [body, detail, ctaLabel, ctaUrl] = bodyByTemplate[template]

  const detailBlock = detail
    ? `<tr><td style="padding:4px 0 18px;color:#475569;font-size:15px;line-height:1.6">${detail}</td></tr>`
    : ""
  const ctaBlock = ctaUrl
    ? `<tr><td><a href="${ctaUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px">${ctaLabel}</a></td></tr>`
    : ""

  const html = `<!doctype html>
<html lang="${locale}">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.08)">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px;color:#ffffff">
          <div style="font-size:18px;font-weight:800">TechVerse</div>
          <div style="font-size:20px;font-weight:700;margin-top:6px">${title}</div>
        </td></tr>
        <tr><td style="padding:28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:15px;color:#0f172a;line-height:1.6">${greeting},</td></tr>
            <tr><td style="padding:12px 0 4px;color:#0f172a;font-size:15px;line-height:1.6">${body}</td></tr>
            ${detailBlock}
            ${ctaBlock}
          </table>
        </td></tr>
        <tr><td style="padding:20px 28px;background:#f8fafc;color:#94a3b8;font-size:12px;line-height:1.5">
          ${T("footer")}<br/>${org}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject: title, html }
}