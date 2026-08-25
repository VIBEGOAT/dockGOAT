"""
DockGOAT Compute Worker - Runs in Hugging Face Spaces
Handles molecular docking jobs asynchronously using AutoDock Vina
Stores files in Supabase Storage
"""

import os
import json
import logging
import subprocess
import tempfile
from datetime import datetime
from typing import Optional
from pathlib import Path

import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="DockGOAT Worker")

# MongoDB client
try:
    mongo_uri = os.getenv("MONGODB_URI")
    if not mongo_uri:
        raise ValueError("MONGODB_URI environment variable not set")
    
    mongo_client = MongoClient(
        mongo_uri, 
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=10000,
    )
    # Verify connection
    mongo_client.admin.command('ping')
    logger.info("MongoDB connection successful")
except ServerSelectionTimeoutError:
    logger.error("Failed to connect to MongoDB")
    mongo_client = None
except Exception as e:
    logger.error(f"MongoDB initialization error: {e}")
    mongo_client = None

# Supabase client
try:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_service_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables required")
    
    supabase: Client = create_client(supabase_url, supabase_service_key)
    logger.info("Supabase client initialized")
except Exception as e:
    logger.error(f"Supabase initialization error: {e}")
    supabase = None

# Storage bucket name
STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "dockgoat-files")


class JobPayload(BaseModel):
    jobId: str
    userId: str
    ligandUrl: str
    targetUrl: str
    vinaParams: dict
    webhookUrl: Optional[str] = None
    mongodbUri: Optional[str] = None
    supabaseUrl: Optional[str] = None
    supabaseServiceKey: Optional[str] = None
    supabaseStorageBucket: Optional[str] = None


def get_db():
    """Get MongoDB database instance"""
    if mongo_client:
        return mongo_client["dockgoat"]
    else:
        raise RuntimeError("MongoDB connection not available")


def update_job_status(job_id: str, status: str, **kwargs):
    """Update job status in MongoDB"""
    try:
        db = get_db()
        jobs_collection = db["dockingjobs"]
        
        update_data = {
            "status": status,
            **kwargs,
        }
        
        jobs_collection.update_one(
            {"_id": job_id},
            {
                "$set": update_data,
            },
        )
        logger.info(f"Updated job {job_id} status to {status}")
    except Exception as e:
        logger.error(f"Failed to update job status: {e}")


def download_from_supabase(url: str, destination: Path) -> bool:
    """Download file from Supabase Storage via public URL"""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        with open(destination, "wb") as f:
            f.write(response.content)
        
        logger.info(f"Downloaded file to {destination}")
        return True
    except Exception as e:
        logger.error(f"Failed to download file from Supabase: {e}")
        return False


def upload_to_supabase(file_path: Path, file_key: str) -> Optional[str]:
    """Upload file to Supabase Storage and return public URL"""
    try:
        if not supabase:
            raise RuntimeError("Supabase client not initialized")
        
        with open(file_path, "rb") as f:
            file_data = f.read()
        
        # Upload to Supabase Storage
        response = supabase.storage.from_(STORAGE_BUCKET).upload(
            file_key,
            file_data,
            {"contentType": "application/octet-stream"}
        )
        
        logger.info(f"Uploaded file to Supabase: {file_key}")
        
        # Get public URL
        public_url_response = supabase.storage.from_(STORAGE_BUCKET).get_public_url(file_key)
        public_url = public_url_response.get("publicUrl") or f"{supabase.storage.url}/storage/v1/object/public/{STORAGE_BUCKET}/{file_key}"
        
        logger.info(f"Public URL: {public_url}")
        return public_url
        
    except Exception as e:
        logger.error(f"Failed to upload file to Supabase: {e}")
        return None


def run_vina_docking(
    ligand_pdbqt: Path,
    target_pdbqt: Path,
    output_pdbqt: Path,
    vina_params: dict,
) -> tuple[bool, Optional[dict]]:
    """Run AutoDock Vina docking simulation"""
    try:
        # Prepare Vina command
        cmd = [
            "vina",
            "--receptor",
            str(target_pdbqt),
            "--ligand",
            str(ligand_pdbqt),
            "--out",
            str(output_pdbqt),
            "--center_x",
            str(vina_params.get("centerX", 0)),
            "--center_y",
            str(vina_params.get("centerY", 0)),
            "--center_z",
            str(vina_params.get("centerZ", 0)),
            "--size_x",
            str(vina_params.get("sizeX", 20)),
            "--size_y",
            str(vina_params.get("sizeY", 20)),
            "--size_z",
            str(vina_params.get("sizeZ", 20)),
            "--exhaustiveness",
            str(vina_params.get("exhaustiveness", 8)),
            "--num_modes",
            str(vina_params.get("numModes", 9)),
            "--energy_range",
            str(vina_params.get("energyRange", 3.0)),
        ]

        logger.info(f"Running Vina with command: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=3600,  # 1 hour timeout
        )

        if result.returncode != 0:
            logger.error(f"Vina error: {result.stderr}")
            return False, None

        # Parse Vina output for affinity results
        affinity_results = parse_vina_output(result.stdout)

        return True, {"affinityResults": affinity_results}

    except subprocess.TimeoutExpired:
        logger.error("Vina execution timed out")
        return False, None
    except Exception as e:
        logger.error(f"Vina execution failed: {e}")
        return False, None


def parse_vina_output(output: str) -> list[dict]:
    """Parse AutoDock Vina output to extract affinity results"""
    results = []
    
    try:
        # Vina output format contains lines like:
        # -7.5      0.000      0.000  -- Best mode
        # -7.3      1.234      1.456
        
        for line in output.split("\n"):
            if line.strip().startswith("-"):
                parts = line.split()
                if len(parts) >= 4:
                    try:
                        affinity = float(parts[0])
                        rmsd_lb = float(parts[1])
                        rmsd_ub = float(parts[2])
                        
                        results.append({
                            "mode": len(results) + 1,
                            "affinity": affinity,
                            "rmsd_lb": rmsd_lb,
                            "rmsd_ub": rmsd_ub,
                        })
                    except ValueError:
                        continue
        
        logger.info(f"Parsed {len(results)} binding modes from Vina output")
        return results
    
    except Exception as e:
        logger.error(f"Error parsing Vina output: {e}")
        return []


def send_webhook_notification(webhook_url: str, job_data: dict):
    """Send webhook notification to client"""
    try:
        response = requests.post(
            webhook_url,
            json=job_data,
            timeout=10,
        )
        response.raise_for_status()
        logger.info(f"Webhook sent successfully to {webhook_url}")
    except Exception as e:
        logger.error(f"Failed to send webhook: {e}")


async def process_docking_job(payload: JobPayload):
    """Main job processing logic"""
    job_id = payload.jobId
    
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        
        try:
            # Update job status to RUNNING
            update_job_status(
                job_id,
                "RUNNING",
                startedAt=datetime.utcnow().isoformat(),
            )
            
            # Download files from Supabase Storage
            ligand_path = tmpdir_path / "ligand.pdbqt"
            target_path = tmpdir_path / "target.pdbqt"
            
            if not download_from_supabase(payload.ligandUrl, ligand_path):
                raise Exception("Failed to download ligand file")
            
            if not download_from_supabase(payload.targetUrl, target_path):
                raise Exception("Failed to download target file")
            
            # Run docking
            output_path = tmpdir_path / "output.pdbqt"
            success, vina_results = run_vina_docking(
                ligand_path,
                target_path,
                output_path,
                payload.vinaParams,
            )
            
            if not success:
                raise Exception("Docking failed")
            
            # Upload results back to Supabase Storage
            file_key = f"{payload.userId}/results/{job_id}/output.pdbqt"
            result_url = upload_to_supabase(output_path, file_key)
            
            if not result_url:
                raise Exception("Failed to upload results")
            
            # Get best affinity score
            best_affinity = None
            if vina_results and vina_results.get("affinityResults"):
                best_affinity = min(
                    [r["affinity"] for r in vina_results["affinityResults"]]
                )
            
            # Update job with results
            update_job_status(
                job_id,
                "COMPLETED",
                completedAt=datetime.utcnow().isoformat(),
                dockingResultUrl=result_url,
                bestAffinity=best_affinity,
                **vina_results or {},
            )
            
            # Send webhook if provided
            if payload.webhookUrl:
                send_webhook_notification(
                    payload.webhookUrl,
                    {
                        "jobId": job_id,
                        "status": "COMPLETED",
                        "resultUrl": result_url,
                        "bestAffinity": best_affinity,
                    },
                )
            
            logger.info(f"Job {job_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Job {job_id} failed: {str(e)}")
            
            # Update job with error
            update_job_status(
                job_id,
                "FAILED",
                completedAt=datetime.utcnow().isoformat(),
                errorMessage=str(e),
            )
            
            # Send failure webhook
            if payload.webhookUrl:
                send_webhook_notification(
                    payload.webhookUrl,
                    {
                        "jobId": job_id,
                        "status": "FAILED",
                        "error": str(e),
                    },
                )


@app.post("/process-job")
async def process_job(payload: JobPayload):
    """
    Endpoint to receive docking jobs from Next.js API
    """
    try:
        logger.info(f"Received job: {payload.jobId}")
        
        # Process job asynchronously
        import asyncio
        asyncio.create_task(process_docking_job(payload))
        
        return {"status": "Job received and queued for processing"}
    
    except Exception as e:
        logger.error(f"Error processing job: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "mongodb": "connected" if mongo_client else "disconnected",
        "supabase": "connected" if supabase else "disconnected",
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "DockGOAT Worker",
        "version": "1.0.0",
        "description": "Molecular docking compute worker with Supabase Storage",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7860)
