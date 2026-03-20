import pytest
from httpx import AsyncClient
from datetime import date

async def get_token(client: AsyncClient, email: str, username: str):
    await client.post(
        "/api/auth/register",
        json={"email": email, "username": username, "password": "password"}
    )
    res = await client.post(
        "/api/auth/login",
        data={"username": email, "password": "password"}
    )
    return res.json()["access_token"]

@pytest.mark.asyncio
async def test_log_habit_and_get_tracking(client: AsyncClient):
    token = await get_token(client, "track@example.com", "trackuser")
    today = date.today().isoformat()
    
    # 1. Create a habit first
    res = await client.post(
        "/api/habits/",
        json={"name": "Water", "tracking_type": "boolean"},
        headers={"Authorization": f"Bearer {token}"}
    )
    habit_id = res.json()["id"]
    
    # 2. Log completion
    response = await client.post(
        f"/api/tracking/habits/{today}",
        json={"habit_id": habit_id, "completed": True},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["completed"] is True
    
    # 3. Get tracking day
    response = await client.get(
        f"/api/tracking/{today}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["date"] == today
    assert len(data["habits"]) == 1
    assert data["habits"][0]["completed"] is True
    # Score should be computed (90.0 because 1/1 habits done but no reflection)
    assert data["discipline_score"] == 90.0
    
    # 4. Add a reflection to get 100
    await client.post(
        f"/api/reflections/{today}",
        json={"answers": {"q1": "Great day"}},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    # 5. Check score again
    response = await client.get(
        f"/api/tracking/{today}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.json()["discipline_score"] == 100.0

@pytest.mark.asyncio
async def test_log_task_and_score(client: AsyncClient):
    token = await get_token(client, "tasktrack@example.com", "ttuser")
    today = date.today().isoformat()
    
    # 1. Add task to plan
    res = await client.post(
        f"/api/plans/{today}/tasks",
        json={"title": "Important Task", "priority_rank": 1},
        headers={"Authorization": f"Bearer {token}"}
    )
    task_id = res.json()["id"]
    
    # 2. Log task completion
    response = await client.post(
        f"/api/tracking/tasks/{today}",
        json={"planned_task_id": task_id, "completed": True},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    
    # 3. Get tracking day
    response = await client.get(
        f"/api/tracking/{today}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["tasks"][0]["completed"] is True
    assert data["discipline_score"] == 90.0
