"""Build the one-page DSH project description (no patient data)."""
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

out = Path(__file__).parent / "MediAudit-AI-DSH-one-page.pdf"
ink = colors.HexColor("#152f31")
teal = colors.HexColor("#16746b")
body = ParagraphStyle("body", fontName="Helvetica", fontSize=10, leading=14,
                      textColor=ink, spaceAfter=9)
head = ParagraphStyle("head", parent=body, fontName="Helvetica-Bold", fontSize=11,
                      textColor=teal, spaceBefore=5, spaceAfter=4)
small = ParagraphStyle("small", parent=body, fontSize=8.5, leading=12)
title = ParagraphStyle("title", parent=body, fontName="Helvetica-Bold", fontSize=28,
                       leading=32, spaceAfter=8)
story = [Paragraph("MediAudit AI", title),
         Paragraph("From a confusing hospital bill to informed questions.", head),
         Paragraph("DSH Hacks V2  |  AI x Healthcare  |  Arham Begani, solo student builder", small),
         Spacer(1, 6)]

sections = [
    ("Who it helps", "Patients and caregivers reading itemized U.S. hospital bills, including people managing recurring oncology visits. Billing codes and unexplained charges make it hard to know what to ask the billing office. MediAudit prepares a conversation; it does not decide that a charge is wrong."),
    ("One complete workflow", "Upload a bill image/PDF or paste text, choose a U.S. region, and receive plain-English line items, charge questions tied to statement evidence, estimated benchmark ranges, a phone script, and a practical checklist. Optional household details support an illustrative financial-assistance estimate. English/Spanish and simpler reading modes are available."),
    ("How AI is used", "Next.js, React and TypeScript provide the interface. Gemini extracts document text and generates the advocacy packet using illustrative billing references. A separate AI pass challenges candidate flags and records supported, adjusted or disputed verdicts. AI coding assistance was used; the repository exposes the implementation."),
    ("New reliability work and checkable evidence", "The October reliability patch computes the aggregate range deterministically after AI review, excludes disputed flags, and replaces an unsupported legal-verification claim. A regression fixture with $74 and $92 charges and $0-$10 benchmarks produces $146-$166, rather than the previously observed $166-$256. Seven automated tests cover this regression, invalid money values, rounding, disputed flags, empty results, range invariants, and factual notices. These test software behavior, not clinical accuracy."),
    ("Judge rerun and limits", "Open the live demo and choose <b>Try an oncology bill</b> to run a clearly fictional statement without private patient data. Review each flag against its quoted evidence and AI-review critique. Model output can vary; AI availability depends on the service. No live hospital-price database, measured patient savings, clinical validation, or guaranteed insurance coverage is claimed. Never delay or change treatment based on this app."),
    ("Prior work", "MediAudit predates DSH and has been entered in other events. The oncology sample/safety guidance and the reliability patch are separately visible in repository history. The existing video demonstrates the general billing workflow; it does not show the new patch. See the patch commit for deployment status."),
]
for label, text in sections:
    story += [Paragraph(label, head), Paragraph(text, body)]
story += [Paragraph('<b>Live:</b> <link href="https://mediaudit-ai.vercel.app">mediaudit-ai.vercel.app</link><br/>'
                    '<b>Code:</b> <link href="https://github.com/Arham-Begani/MediAudit-AI">github.com/Arham-Begani/MediAudit-AI</link><br/>'
                    '<b>Demo video:</b> <link href="https://youtu.be/pWq8UerGpXg">youtu.be/pWq8UerGpXg</link>', small)]
SimpleDocTemplate(str(out), pagesize=(612, 792), rightMargin=42, leftMargin=42,
                  topMargin=32, bottomMargin=28, title="MediAudit AI - DSH project description",
                  author="Arham Begani").build(story)
print(out)
