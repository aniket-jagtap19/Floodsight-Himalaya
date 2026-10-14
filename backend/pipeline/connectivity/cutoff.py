"""pipeline/connectivity/cutoff.py — Settlement isolation & cutoff analysis stub."""

from __future__ import annotations

from pipeline.contracts import ConnectivityResult, RoadGraph
from pipeline.exceptions import NotImplementedStage


def run(
    graph: RoadGraph,
    affected_edges: list[str],
    destinations: list[str] | None = None,
) -> ConnectivityResult:
    """Determine which settlements lost road access to regional hubs.

    Evaluates pre-event vs post-event shortest paths across the road network graph.
    Settlements cut off are those reachable before the event but with no remaining
    mapped road path to any designated destination hub (Rules §13).

    Args:
        graph: Topological road network graph.
        affected_edges: List of road edge IDs severed by flooding.
        destinations: Optional target destination nodes (e.g. district headquarters, hospitals).

    Returns:
        ConnectivityResult: List of isolated settlements and isolation counts.

    Raises:
        NotImplementedStage: Settlement cutoff analysis has not been implemented.
    """
    raise NotImplementedStage(
        "connectivity_cutoff",
        "Settlement cutoff analysis has not been implemented.",
    )
