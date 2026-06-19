# C:\ai-interviewer\create_sample_resume.py
import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def create_resume(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'Name',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#6d5acf')
    )
    
    subtitle_style = ParagraphStyle(
        'Contact',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#666666')
    )
    
    heading_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#333333'),
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#444444'),
        spaceAfter=6
    )
    
    bold_body_style = ParagraphStyle(
        'BoldBody',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    story = []
    
    # Header
    story.append(Paragraph("Alice Vance", title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Email: alice.vance@example.com  |  Phone: +1 (555) 019-2834  |  Location: San Francisco, CA", subtitle_style))
    story.append(Spacer(1, 10))
    story.append(Paragraph("<font color='#6d5acf'><b>__________________________________________________________________________________</b></font>", body_style))
    story.append(Spacer(1, 10))
    
    # Profile
    story.append(Paragraph("Professional Summary", heading_style))
    story.append(Paragraph("Experienced and results-oriented Software Engineer with a strong background in developing scalable web applications, RESTful APIs, and cloud microservices. Proficient in Python, FastAPI, React, and cloud platforms. Passionate about writing clean, maintainable code and optimizing system performance.", body_style))
    story.append(Spacer(1, 8))
    
    # Skills
    story.append(Paragraph("Core Technical Skills", heading_style))
    story.append(Paragraph("<b>Programming Languages:</b> Python, JavaScript, TypeScript, SQL, HTML/CSS", body_style))
    story.append(Paragraph("<b>Frameworks & Tools:</b> FastAPI, React, Next.js, Node.js, SQLAlchemy, PostgreSQL, Docker, AWS (S3, EC2), Git", body_style))
    story.append(Spacer(1, 8))
    
    # Experience
    story.append(Paragraph("Work Experience", heading_style))
    
    # Job 1
    story.append(Paragraph("<b>Senior Software Engineer</b>  |  TechCorp Inc. (2022 - Present)", bold_body_style))
    story.append(Paragraph("• Designed, developed, and maintained robust backend services using FastAPI and Python in a containerized Docker environment.<br/>"
                           "• Optimized database query speeds in PostgreSQL using indexing and eager loads, reducing API latency by 35%.<br/>"
                           "• Spearheaded integration of Google Cloud AI tools into the internal document analyzer services.", body_style))
    story.append(Spacer(1, 6))
    
    # Job 2
    story.append(Paragraph("<b>Software Developer</b>  |  SoftSys Solutions (2020 - 2022)", bold_body_style))
    story.append(Paragraph("• Built interactive client-facing web application dashboards using React, TypeScript, and CSS.<br/>"
                           "• Created clean RESTful APIs using Python Flask and integrated them with frontend user interfaces.", body_style))
    story.append(Spacer(1, 8))
    
    # Education
    story.append(Paragraph("Education", heading_style))
    story.append(Paragraph("<b>B.S. in Computer Science</b>  |  State University (2016 - 2020)<br/>"
                           "• Graduated with Honors. Co-founder of the Computer Science Student Club.", body_style))
    story.append(Spacer(1, 8))
    
    # Projects
    story.append(Paragraph("Key Projects", heading_style))
    story.append(Paragraph("<b>TaskFlow</b>: A project tracking board built using React, FastAPI, Docker, and PostgreSQL. Features real-time state synchronization, user authentication, and data exporting.", body_style))
    
    doc.build(story)
    print("Resume PDF generated successfully at:", output_path)

if __name__ == "__main__":
    create_resume("sample_resume.pdf")
