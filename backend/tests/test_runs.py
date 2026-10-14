import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_analyze_rejects_invalid_date_ordering():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # osmDate >= floodDate
        payload = {
            "bbox": [85.12, 27.9, 85.42, 28.3],
            "floodDate": "2026-08-26",
            "osmDate": "2026-08-26",
            "useOptical": False,
        }
        res = await client.post("/api/analyze", json=payload)
        assert res.status_code == 422
        body = res.json()
        assert "error" in body
        assert "OSM snapshot must be dated before" in body["error"]


@pytest.mark.asyncio
async def test_analyze_rejects_huge_bbox():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Huge bbox > 5000 km2
        payload = {
            "bbox": [80.0, 26.0, 86.0, 30.0],
            "floodDate": "2026-08-26",
            "osmDate": "2026-07-27",
            "useOptical": False,
        }
        res = await client.post("/api/analyze", json=payload)
        assert res.status_code == 422
        body = res.json()
        assert "error" in body
        assert "exceeds the maximum limit of 5000 km²" in body["error"]


@pytest.mark.asyncio
async def test_unknown_run_returns_404():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res1 = await client.get("/api/runs/non-existent-run-id/status")
        assert res1.status_code == 404
        assert res1.json() == {"error": "run not found"}

        res2 = await client.get("/api/runs/non-existent-run-id/result")
        assert res2.status_code == 404
        assert res2.json() == {"error": "run not found"}


@pytest.mark.asyncio
async def test_analyze_lifecycle_and_status_progress(monkeypatch):
    from app.settings import settings

    monkeypatch.setattr(settings, "pipeline_mode", "mock")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "bbox": [85.12, 27.9, 85.42, 28.3],
            "floodDate": "2026-08-26",
            "osmDate": "2026-07-27",
            "useOptical": True,
        }
        res = await client.post("/api/analyze", json=payload)
        assert res.status_code == 202
        data = res.json()
        assert "runId" in data
        run_id = data["runId"]

        # Check initial status is queued or running (mock path advances through steps)
        status_res = await client.get(f"/api/runs/{run_id}/status")
        assert status_res.status_code == 200
        status_data = status_res.json()
        assert status_data["runId"] == run_id
        assert status_data["state"] in ("queued", "running")
        assert len(status_data["steps"]) == 9

        # Poll status until it progresses to succeeded (timeout after 12s)
        for _ in range(25):
            await asyncio.sleep(0.5)
            s_res = await client.get(f"/api/runs/{run_id}/status")
            if s_res.json()["state"] == "succeeded":
                break
        else:
            pytest.fail("Run did not progress to succeeded within timeout")

        # Verify result content
        result_res = await client.get(f"/api/runs/{run_id}/result")
        assert result_res.status_code == 200
        result_data = result_res.json()
        assert result_data["runId"] == run_id
        assert result_data["eventDate"] == "2026-08-26"
        assert result_data["osmSnapshotDate"] == "2026-07-27"
        assert result_data["metadata"]["dataMode"] == "mock"
        assert any(
            "Geometry is placeholder demo data" in note for note in result_data["quality"]["notes"]
        )

