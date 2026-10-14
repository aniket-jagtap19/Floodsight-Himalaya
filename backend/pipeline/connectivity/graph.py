"""pipeline/connectivity/graph.py — Road network graph construction stub."""

from __future__ import annotations

from pipeline.contracts import OsmLayers, RoadGraph
from pipeline.exceptions import NotImplementedStage


def build(osm: OsmLayers) -> RoadGraph:
    """Build a traversable road network graph from OSM road geometries.

    Constructs network topology where intersections are nodes and road segments are edges,
    retaining road classifications, lengths, and bridges as edge attributes.

    Args:
        osm: Historical OSM layers.

    Returns:
        RoadGraph: Topological network graph with edge attributes.

    Raises:
        NotImplementedStage: Road network graph construction has not been implemented.
    """
    raise NotImplementedStage(
        "graph_construction",
        "Road network graph construction has not been implemented.",
    )
