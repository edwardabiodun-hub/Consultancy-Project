from pathlib import Path
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle

OUT = Path("public/owner-independence-scorecard.pdf")
OUT.parent.mkdir(parents=True, exist_ok=True)
forest, bronze, ink, stone = map(HexColor, ["#173F32", "#9A693A", "#18231E", "#E6E3DA"])
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleEA", parent=styles["Title"], fontName="Times-Roman", fontSize=27, leading=31, textColor=ink, spaceAfter=16))
styles.add(ParagraphStyle(name="HEA", parent=styles["Heading2"], fontName="Times-Roman", fontSize=18, leading=22, textColor=forest, spaceBefore=14, spaceAfter=8))
styles.add(ParagraphStyle(name="BodyEA", parent=styles["BodyText"], fontName="Helvetica", fontSize=10, leading=15, textColor=ink, spaceAfter=7))
styles.add(ParagraphStyle(name="SmallEA", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.5, leading=12, textColor=ink))
styles.add(ParagraphStyle(name="CalloutEA", parent=styles["BodyText"], fontName="Helvetica", fontSize=10, leading=15, textColor=HexColor("#FFFFFF")))

dims = [
("Decision dependence", ["Routine decisions stop when I am unavailable.","My team regularly seeks approval for choices within their roles.","Escalation rules and decision rights are unclear."]),
("Information and reporting dependence", ["I assemble or reconcile the management picture personally.","Reports explain the past but do not identify the next action.","Critical metrics differ across systems or teams."]),
("Process dependence", ["Important workflows rely on memory or individual heroics.","Exceptions are handled differently depending on who is involved.","A new employee could not follow our critical processes unaided."]),
("Customer relationship dependence", ["Key customers primarily identify the relationship with me.","Customer history and commitments are not consistently recorded.","My absence would create material retention or revenue risk."]),
("Leadership and accountability dependence", ["Owners and deadlines are unclear for recurring priorities.","Leadership meetings report activity more than resolve issues.","Problems return to me because accountability is not sustained."]),
]

story=[Paragraph("THE OWNER INDEPENDENCE SCORECARD", styles["SmallEA"]), Spacer(1,10),
Paragraph("Can your business run without you?", styles["TitleEA"]),
Paragraph("Fifteen questions to identify where information, decisions, relationships, and critical work still depend on the owner.", styles["BodyEA"]),
Spacer(1,8),Paragraph("<b>How to score:</b> Rate each statement 0 (rarely true), 1 (sometimes true), or 2 (consistently true). Higher scores indicate greater owner dependence.", styles["BodyEA"])]
for idx,(name,qs) in enumerate(dims,1):
    story += [Paragraph(f"{idx}. {name}",styles["HEA"])]
    data=[["Statement","0","1","2"]]+[[q,"","",""] for q in qs]
    t=Table(data,colWidths=[5.5*inch,.38*inch,.38*inch,.38*inch],repeatRows=1)
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),forest),("TEXTCOLOR",(0,0),(-1,0),HexColor("#FFFFFF")),("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("FONTNAME",(0,1),(-1,-1),"Helvetica"),("FONTSIZE",(0,0),(-1,-1),8.5),("LEADING",(0,0),(-1,-1),11),("GRID",(0,0),(-1,-1),.35,HexColor("#BFC3BC")),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("ALIGN",(1,1),(-1,-1),"CENTER"),("ROWBACKGROUNDS",(0,1),(-1,-1),[HexColor("#FBFAF6"),HexColor("#F1EFE8")]),("LEFTPADDING",(0,0),(-1,-1),7),("RIGHTPADDING",(0,0),(-1,-1),7),("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6)]))
    story.append(t)
    if idx==3: story.append(PageBreak())
story += [Spacer(1,14),Paragraph("Interpret your score",styles["HEA"]),
Table([["0-7","Low dependence","The business has useful operating resilience. Focus on isolated weak points."],["8-17","Moderate dependence","Several recurring dependencies constrain scale, visibility, or freedom."],["18-30","High dependence","The owner remains a significant operating system and single point of failure."]],colWidths=[.65*inch,1.5*inch,4.5*inch],style=TableStyle([("BACKGROUND",(0,0),(-1,-1),stone),("TEXTCOLOR",(0,0),(-1,-1),ink),("GRID",(0,0),(-1,-1),.35,HexColor("#BFC3BC")),("FONTNAME",(0,0),(1,-1),"Helvetica-Bold"),("FONTNAME",(2,0),(-1,-1),"Helvetica"),("FONTSIZE",(0,0),(-1,-1),8.2),("VALIGN",(0,0),(-1,-1),"TOP"),("PADDING",(0,0),(-1,-1),7)])),
Paragraph("Three immediate actions",styles["HEA"]),Paragraph("<b>1.</b> Circle the highest-scoring dimension. <b>2.</b> Choose one recurring dependency inside it. <b>3.</b> document the current decision, information, and handoff path before selecting technology.",styles["BodyEA"]),
Spacer(1,12),Table([[Paragraph("<b>Want a focused diagnosis?</b><br/>The 10-business-day Owner Independence Diagnostic identifies the highest-value dependencies, produces a 90-day roadmap, and demonstrates one concrete improvement.",styles["CalloutEA"])]],colWidths=[6.65*inch],style=TableStyle([("BACKGROUND",(0,0),(-1,-1),forest),("BOX",(0,0),(-1,-1),1,bronze),("PADDING",(0,0),(-1,-1),14)]))]

def footer(canvas, doc):
    canvas.saveState(); canvas.setStrokeColor(bronze); canvas.line(.75*inch,.55*inch,7.75*inch,.55*inch)
    canvas.setFont("Helvetica",7.5); canvas.setFillColor(ink); canvas.drawString(.75*inch,.38*inch,"Edward Abiodun Advisory | Founder Independence & Decision Systems")
    canvas.drawRightString(7.75*inch,.38*inch,f"{doc.page}"); canvas.restoreState()

SimpleDocTemplate(str(OUT),pagesize=letter,rightMargin=.75*inch,leftMargin=.75*inch,topMargin=.62*inch,bottomMargin=.7*inch,title="Owner Independence Scorecard",author="Edward Abiodun").build(story,onFirstPage=footer,onLaterPages=footer)
print(OUT)
