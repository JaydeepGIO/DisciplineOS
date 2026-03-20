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
async def test_create_and_get_plan(client: AsyncClient):
    token = await get_token(client, "plan@example.com", "planuser")
    today = date.today().isoformat()
    
    # Create plan
    response = await client.post(
        f"/api/plans/{today}",
        json={
            "morning_intention": "Stay focused",
            "notes": "Testing notes",
            "tasks": [
                {"title": "Test Task 1", "priority_rank": 1},
                {"title": "Test Task 2", "priority_rank": 2}
            ]
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["morning_intention"] == "Stay focused"
    assert len(data["tasks"]) == 2
    
    # Get plan
    response = await client.get(
        f"/api/plans/{today}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["morning_intention"] == "Stay focused"
    assert len(data["tasks"]) == 2

@pytest.mark.asyncio
async def test_add_task_to_plan(client: AsyncClient):
    token = await get_token(client, "task@example.com", "taskuser")
    today = date.today().isoformat()
    
    # Add task (should create plan if not exists)
    response = await client.post(
        f"/api/plans/{today}/tasks",
        json={"title": "Dynamic Task", "priority_rank": 3},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Dynamic Task"
    
    # Verify plan was created
    response = await client.get(
        f"/api/plans/{today}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert len(response.json()["tasks"]) == 1
