from fastapi import FastAPI, APIRouter
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime
from supabase import create_client, Client


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Job Meta Tags Route for Social Media Sharing
@api_router.get("/job/{job_id}", response_class=HTMLResponse)
async def render_job_meta(job_id: str):
    """
    Renders HTML with Open Graph meta tags for social media sharing.
    This route is called by crawlers (WhatsApp, Facebook, Twitter) before JavaScript execution.
    After meta tags are read, it redirects to the React app.
    """
    try:
        # Initialize Supabase client
        supabase_url = os.environ.get('SUPABASE_URL')
        supabase_key = os.environ.get('SUPABASE_KEY')
        app_url = os.environ.get('APP_URL', 'http://localhost:3000')
        
        if not supabase_url or not supabase_key:
            logger.error("Supabase credentials not found in environment")
            return generate_fallback_html(job_id, app_url)
        
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Fetch job data from public_jobs table
        response = supabase.table('public_jobs').select('*').eq('id', job_id).execute()
        
        if not response.data or len(response.data) == 0:
            logger.warning(f"Job not found: {job_id}")
            return generate_fallback_html(job_id, app_url)
        
        job = response.data[0]
        
        # Build meta tag data
        visa_type = job.get('visa_type', 'H-2B')
        job_title = job.get('job_title', 'Job Opportunity')
        company = job.get('company', 'Company')
        city = job.get('city', '')
        state = job.get('state', '')
        salary = job.get('salary')
        openings = job.get('openings')
        
        title = f"{visa_type}: {job_title} - {company}"
        location = f"{city}, {state}".strip(', ')
        
        # Build description with key info: openings, location, salary
        description_parts = []
        if openings:
            openings_text = f"{openings} vaga" if openings == 1 else f"{openings} vagas"
            description_parts.append(openings_text)
        description_parts.append(visa_type)
        if location:
            description_parts.append(location)
        if salary:
            description_parts.append(f"${salary:.2f}/hr")
        description = ' • '.join(description_parts)
        
        share_url = f"{app_url}/job/{job_id}"
        logo_url = 'https://storage.googleapis.com/gpt-engineer-file-uploads/qLZbvqI1JJV7s7qLCqiN2u0iNM93/uploads/1769111120896-Gemini_Generated_Image_yeubloyeubloyeub.png'
        
        # Generate HTML with meta tags
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- Basic Meta Tags -->
    <title>{title} | H2 Linker</title>
    <meta name="description" content="{description}">
    
    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="{share_url}">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{description}">
    <meta property="og:image" content="{logo_url}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="H2 Linker">
    <meta property="og:locale" content="en_US">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="{share_url}">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{description}">
    <meta name="twitter:image" content="{logo_url}">
    
    <!-- Redirect to React app -->
    <meta http-equiv="refresh" content="0;url={share_url}">
    <script>
        window.location.href = "{share_url}";
    </script>
    
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            text-align: center;
        }}
        h1 {{ color: #2563eb; }}
        p {{ color: #64748b; margin: 10px 0; }}
        a {{ color: #2563eb; text-decoration: none; }}
    </style>
</head>
<body>
    <h1>🔗 {title}</h1>
    <p>{description}</p>
    <p>Redirecting to job details...</p>
    <p><a href="{share_url}">Click here if not redirected automatically</a></p>
</body>
</html>"""
        
        logger.info(f"Generated meta tags for job: {job_id}")
        return HTMLResponse(content=html, status_code=200)
        
    except Exception as e:
        logger.error(f"Error generating meta tags for job {job_id}: {str(e)}")
        return generate_fallback_html(job_id, app_url)


def generate_fallback_html(job_id: str, app_url: str) -> HTMLResponse:
    """Generate fallback HTML when job data cannot be fetched"""
    share_url = f"{app_url}/job/{job_id}"
    logo_url = 'https://storage.googleapis.com/gpt-engineer-file-uploads/qLZbvqI1JJV7s7qLCqiN2u0iNM93/uploads/1769111120896-Gemini_Generated_Image_yeubloyeubloyeub.png'
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Job Opportunity | H2 Linker</title>
    <meta name="description" content="H2 Linker - Find H-2A and H-2B job opportunities">
    <meta property="og:title" content="Job Opportunity | H2 Linker">
    <meta property="og:description" content="H2 Linker - Find H-2A and H-2B job opportunities">
    <meta property="og:image" content="{logo_url}">
    <meta property="og:url" content="{share_url}">
    <meta http-equiv="refresh" content="0;url={share_url}">
    <script>window.location.href = "{share_url}";</script>
</head>
<body>
    <p>Redirecting to job details...</p>
    <a href="{share_url}">Click here if not redirected</a>
</body>
</html>"""
    
    return HTMLResponse(content=html, status_code=200)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
