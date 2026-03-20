import pytest
from httpx import AsyncClient

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
async def test_create_habit(client: AsyncClient):
    token = await get_token(client, "habit@example.com", "habituser")
    
    response = await client.post(
        "/api/habits/",
        json={
            "name": "Daily Meditation",
            "category": "mental",
            "tracking_type": "duration",
            "target_value": 20,
            "target_unit": "minutes"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Daily Meditation"
    assert data["target_value"] == 20

@pytest.mark.asyncio
async def test_get_habits(client: AsyncClient):
    token = await get_token(client, "gethabit@example.com", "gethabituser")
    
    # Create two habits
    await client.post(
        "/api/habits/",
        json={"name": "Habit 1"},
        headers={"Authorization": f"Bearer {token}"}
    )
    await client.post(
        "/api/habits/",
        json={"name": "Habit 2"},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    response = await client.get(
        "/api/habits/",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert len(response.json()) >= 2
