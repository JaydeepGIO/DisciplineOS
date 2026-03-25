from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from typing import List, Optional
import uuid
import os

from ..dependencies import get_current_user
from ..schemas import ReportRequest, ReportJobSchema
from ..workers.tasks.report_tasks import generate_report

import platform

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
async def create_report(
    report_in: ReportRequest,
    current_user = Depends(get_current_user)
):
    job_id = str(uuid.uuid4())
    # In a real app, you'd store the job status in Redis/DB
    # For now, we trigger the Celery task
    generate_report.delay(str(current_user.id), job_id, report_in.model_dump())
    return {"job_id": job_id, "status": "queued"}

@router.get("/{job_id}")
async def get_report_status(
    job_id: str,
    current_user = Depends(get_current_user)
):
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    storage_dir = os.path.join(base_dir, "generated_reports")
    status = "processing"
    download_url = None
    
    # Check for failure first
    if os.path.exists(os.path.join(storage_dir, f"report_{job_id}.failed")):
        return {"job_id": job_id, "status": "failed", "download_url": None}

    # Check for any possible extension
    for ext in [".pdf", ".txt", ".csv", ".json", ".zip"]:
        f_path = os.path.join(storage_dir, f"report_{job_id}{ext}")
        if os.path.exists(f_path):
            status = "completed"
            download_url = f"/api/reports/{job_id}/download"
            break
            
    return {
        "job_id": job_id, 
        "status": status, 
        "download_url": download_url
    }

@router.get("/{job_id}/download")
async def download_report(
    job_id: str,
    current_user = Depends(get_current_user)
):
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    storage_dir = os.path.join(base_dir, "generated_reports")
    
    file_path = None
    media_type = "application/octet-stream"
    
    for ext in [".pdf", ".txt", ".csv", ".json", ".zip"]:
        f_path = os.path.join(storage_dir, f"report_{job_id}{ext}")
        if os.path.exists(f_path):
            file_path = f_path
            if ext == ".pdf": media_type = "application/pdf"
            elif ext == ".txt": media_type = "text/plain"
            elif ext == ".csv": media_type = "text/csv"
            elif ext == ".json": media_type = "application/json"
            elif ext == ".zip": media_type = "application/zip"
            break
            
    if not file_path:
        raise HTTPException(status_code=404, detail="Report not ready or not found")
    
    return FileResponse(
        path=file_path,
        filename=f"DisciplineOS_Report_{job_id}{os.path.splitext(file_path)[1]}",
        media_type=media_type
    )
