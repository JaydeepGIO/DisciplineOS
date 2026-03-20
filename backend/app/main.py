from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routers import auth, habits, tracking, plans, reflections, analytics, scoring, reports

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(habits.router, prefix="/api")
app.include_router(tracking.router, prefix="/api")
app.include_router(plans.router, prefix="/api")
app.include_router(reflections.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(scoring.router, prefix="/api")
app.include_router(reports.router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Welcome to DisciplineOS API"}
