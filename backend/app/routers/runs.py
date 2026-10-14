import logging
import math

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    CopilotAnswer,
    CopilotAskRequest,
    CopilotMiniMap,
    CopilotTable,
    ErrorResponse,
    NumberSource,
    RecentRun,
    RunResult,
    RunStatus,
)
from app.settings import settings
from app.store import run_store

logger = logging.getLogger("floodsight.api")

router = APIRouter(prefix="/api", tags=["runs"])


def calculate_bbox_area_km2(bbox: tuple[float, float, float, float]) -> float:
    """
    Equirectangular area approximation for a bounding box [w, s, e, n].
    Note: For moderate-sized bounding boxes around Nepal's latitude, this equirectangular approximation
    (1 degree latitude ~ 110.574 km, 1 degree longitude ~ 111.320 * cos(mid_lat) km)
    is sufficient for preliminary sanity checks against the 5000 km2 limit.
    """
    w, s, e, n = bbox
    mid_lat_rad = math.radians((s + n) / 2.0)
    width_km = abs(e - w) * 111.320 * math.cos(mid_lat_rad)
    height_km = abs(n - s) * 110.574
    return width_km * height_km


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    status_code=202,
    responses={422: {"model": ErrorResponse}},
)
async def start_analysis(request: AnalyzeRequest):
    logger.info(
        "Analyze request received: bbox=%s floodDate=%s osmDate=%s useOptical=%s",
        request.bbox,
        request.flood_date,
        request.osm_date,
        request.use_optical,
    )

    # 1. Validate temporal ordering: OSM snapshot must be before the flood event
    if request.osm_date >= request.flood_date:
        return JSONResponse(
            status_code=422,
            content={"error": "The OSM snapshot must be dated before the flood event."},
        )

    # 2. Validate area bounds: equirectangular approximation limit of 5000 km2
    area_km2 = calculate_bbox_area_km2(request.bbox)
    if area_km2 > 5000.0:
        return JSONResponse(
            status_code=422,
            content={
                "error": f"Selected area ({area_km2:.0f} km²) exceeds the maximum limit of 5000 km²."
            },
        )

    # 3. Create run in store and return 202
    run_id = await run_store.create_run(
        bbox=request.bbox,
        flood_date=request.flood_date,
        osm_date=request.osm_date,
        use_optical=request.use_optical,
    )

    return AnalyzeResponse(run_id=run_id)


@router.get(
    "/runs/{run_id}/status",
    response_model=RunStatus,
    response_model_exclude_unset=True,
    responses={404: {"model": ErrorResponse}},
)
async def get_run_status(run_id: str):
    run_status = await run_store.get_status(run_id)
    if not run_status:
        return JSONResponse(
            status_code=404,
            content={"error": "run not found"},
        )
    return run_status


@router.get(
    "/runs/{run_id}/result",
    response_model=RunResult,
    response_model_exclude_unset=True,
    responses={404: {"model": ErrorResponse}},
)
async def get_run_result(run_id: str):
    result = await run_store.get_result(run_id)
    if not result:
        return JSONResponse(
            status_code=404,
            content={"error": "run not found"},
        )
    return result


@router.get(
    "/runs",
    response_model=list[RecentRun],
    response_model_exclude_unset=True,
)
async def list_runs():
    return await run_store.list_runs()


@router.post(
    "/runs/{run_id}/ask",
    response_model=CopilotAnswer,
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
async def ask_copilot_endpoint(run_id: str, body: CopilotAskRequest):
    """Answer a grounded question about a completed run.

    The LLM may only quote facts from the verified RunResult.
    Every number in the answer traces to a tool call (FR-15).
    The API key lives on the server — never in the frontend bundle.
    """
    logger.info("Copilot ask: run=%s lang=%s q=%r", run_id, body.lang, body.question[:60])
    result = await run_store.get_result(run_id)
    if not result:
        return JSONResponse(status_code=404, content={"error": "run not found"})

    from pipeline.reporting.copilot import ask as copilot_ask  # noqa: PLC0415
    from pipeline.reporting.llm import make_llm_client  # noqa: PLC0415

    llm = make_llm_client(
        provider=settings.llm_provider,
        api_key=settings.llm_api_key,
        model=settings.llm_model,
    )
    data = copilot_ask(question=body.question, result=result, llm=llm, lang=body.lang)

    return CopilotAnswer(
        available=data.available,
        markdown=data.markdown,
        sources={
            k: NumberSource(
                display=s.display,
                layer=s.layer,
                query=s.query,
                value=s.value,
                run_id=s.run_id,
            )
            for k, s in (data.sources or {}).items()
        },
        tools=data.tools,
        table=CopilotTable(columns=data.table["columns"], rows=data.table["rows"])
        if data.table
        else None,
        mini_map=CopilotMiniMap(village_ids=data.mini_map["village_ids"])
        if data.mini_map
        else None,
        note=data.note,
    )


@router.get(
    "/runs/{run_id}/report",
    response_model=CopilotAnswer,
    responses={404: {"model": ErrorResponse}},
)
async def get_report_endpoint(run_id: str, lang: str = "en"):
    """Generate a one-page grounded situation report.

    If provenance is not 'live', the report is prefixed with 'DEMO REPORT'.
    The LLM polishes wording only; all numbers come from tool results (FR-15).
    """
    logger.info("Report requested: run=%s lang=%s", run_id, lang)
    result = await run_store.get_result(run_id)
    if not result:
        return JSONResponse(status_code=404, content={"error": "run not found"})

    from pipeline.reporting.llm import make_llm_client  # noqa: PLC0415
    from pipeline.reporting.report import build_report  # noqa: PLC0415

    llm = make_llm_client(
        provider=settings.llm_provider,
        api_key=settings.llm_api_key,
        model=settings.llm_model,
    )
    data = build_report(result=result, llm=llm, lang=lang)

    return CopilotAnswer(
        available=data.available,
        markdown=data.markdown,
        sources={
            k: NumberSource(
                display=s.display,
                layer=s.layer,
                query=s.query,
                value=s.value,
                run_id=s.run_id,
            )
            for k, s in (data.sources or {}).items()
        },
        tools=data.tools,
        table=CopilotTable(columns=data.table["columns"], rows=data.table["rows"])
        if data.table
        else None,
        mini_map=CopilotMiniMap(village_ids=data.mini_map["village_ids"])
        if data.mini_map
        else None,
        note=data.note,
    )
