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
async def test_create_reflection_template(client: AsyncClient):
    token = await get_token(client, "reftemp@example.com", "refuser")
    
    response = await client.post(
        "/api/reflections/templates",
        json={
            "name": "Daily Reflection",
            "is_default": True,
            "questions": [
                {"id": "q1", "text": "How was your day?", "type": "text", "order": 1}
            ]
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Daily Reflection"

@pytest.mark.asyncio
async def test_create_and_get_reflection(client: AsyncClient):
    token = await get_token(client, "refentry@example.com", "refentryuser")
    today = date.today().isoformat()
    
    # Create reflection
    response = await client.post(
        f"/api/reflections/{today}",
        json={
            "answers": {"q1": "It was productive"},
            "mood_score": 8,
            "energy_score": 7
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 201
    assert response.json()["mood_score"] == 8
    
    # Get reflection
    response = await client.get(
        f"/api/reflections/{today}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["mood_score"] == 8
