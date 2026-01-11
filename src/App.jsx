import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import { supabase } from './supabaseClient';

// Group colors configuration
const GROUP_COLORS = {
    govt: '#FF9933',
    opposition: '#00FF00',
    business: '#00BFFF',
    party: '#FFF',
    default: '#ccc'
};

const App = () => {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const [selectedNode, setSelectedNode] = useState(null);
    const [connectionLegend, setConnectionLegend] = useState([]);
    const fgRef = useRef();

    // Fetch data from Supabase
    const fetchGraphData = useCallback(async () => {
        try {
            setLoading(true);

            // Fetch nodes
            const { data: nodesData, error: nodesError } = await supabase
                .from('nodes')
                .select('*');

            if (nodesError) throw nodesError;

            // Fetch edges
            const { data: edgesData, error: edgesError } = await supabase
                .from('edges')
                .select('*');

            if (edgesError) throw edgesError;

            // Transform data
            // react-force-graph expects mutable objects, so we clone
            const nodes = nodesData.map(node => ({ ...node }));

            // Define meaningful names for different connection colors
            const COLOR_MEANINGS = {
                'orange': 'Political Alliance',
                'green': 'Opposition Network',
                'blue': 'Business Connection',
                'red': 'Rivalry',
                'purple': 'Family Relation',
                'grey': 'Strategic/Advisory',
                'gray': 'Strategic/Advisory',
                'brown': 'Ideological'
            };

            // Count connections by color
            const colorCounts = {};
            edgesData.forEach(link => {
                const color = link.color || '#999';

                if (!colorCounts[color]) {
                    // Get a meaningful name for this color
                    const colorName = COLOR_MEANINGS[color.toLowerCase()] ||
                        color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();

                    colorCounts[color] = {
                        color,
                        type: colorName,
                        count: 0
                    };
                }
                colorCounts[color].count++;
            });

            // Sort by count and get top 5
            const sortedTypes = Object.values(colorCounts)
                .sort((a, b) => b.count - a.count);

            const top5Colors = new Set(sortedTypes.slice(0, 5).map(t => t.color));
            const othersColor = '#666666';

            // Create legend entries
            const legendEntries = sortedTypes.slice(0, 5).map(t => ({
                color: t.color,
                type: t.type,
                count: t.count
            }));

            // Calculate "others" count
            const othersCount = sortedTypes
                .slice(5)
                .reduce((sum, t) => sum + t.count, 0);

            if (othersCount > 0) {
                legendEntries.push({
                    color: othersColor,
                    type: 'Others',
                    count: othersCount
                });
            }

            setConnectionLegend(legendEntries);

            // Update links with top 5 colors or "others"
            const links = edgesData.map(link => {
                const originalColor = link.color || '#999';
                const finalColor = top5Colors.has(originalColor) ? originalColor : othersColor;

                return {
                    ...link,
                    source: link.source,
                    target: link.target,
                    color: finalColor,
                    originalColor: originalColor,
                    originalType: link.type
                };
            });

            setGraphData({ nodes, links });
        } catch (error) {
            console.error('Error fetching graph data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGraphData();
    }, [fetchGraphData]);

    // Node Object Customization (Sphere + Text)
    const nodeThreeObject = useCallback((node) => {
        const groupColor = GROUP_COLORS[node.group_type] || GROUP_COLORS.default;
        const sphereSize = node.val ? Math.log(node.val) * 2 + 5 : 5; // Scale size by importance

        const group = new THREE.Group();

        // 1. Create Sphere with Image Texture
        let material;
        if (node.img) {
            const texture = new THREE.TextureLoader().load(node.img);
            material = new THREE.MeshLambertMaterial({
                map: texture,
                color: 0xffffff
            });
        } else {
            material = new THREE.MeshLambertMaterial({ color: groupColor });
        }

        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(sphereSize, 16, 16),
            material
        );
        group.add(sphere);

        // 2. Add Text Label above the node
        const sprite = new SpriteText(node.name);
        sprite.color = groupColor;
        sprite.textHeight = 4;
        sprite.position.y = sphereSize + 4; // Position above sphere
        group.add(sprite);

        return group;
    }, []);

    // Handle Node Click
    const handleNodeClick = useCallback((node) => {
        // 1. Aim at node from outside it
        const distance = 40;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

        if (fgRef.current) {
            fgRef.current.cameraPosition(
                { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
                node, // lookAt
                3000  // ms transition duration
            );
        }

        // 2. Set selected node for Modal
        setSelectedNode(node);
    }, []);

    if (loading) {
        return <div className="loading-container">Loading Influence Graph...</div>;
    }

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <ForceGraph3D
                ref={fgRef}
                graphData={graphData}
                nodeThreeObject={nodeThreeObject}
                nodeLabel="name"

                // Link Styling
                linkColor={(link) => link.color || '#999'}
                linkWidth={1}
                linkDirectionalParticles={2}
                linkDirectionalParticleSpeed={0.005}
                linkDirectionalParticleWidth={1}

                // Interaction
                onNodeClick={handleNodeClick}

                // Physics / Force parameters to increase node spacing
                d3AlphaDecay={0.01}
                d3VelocityDecay={0.2}
                cooldownTicks={200}
                numDimensions={3}
                dagMode={null}

                // Scene config
                backgroundColor="#000000"
                showNavInfo={false}
            />

            {/* Title Overlay */}
            <div style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                color: 'white',
                background: 'rgba(0,0,0,0.5)',
                padding: '10px 20px',
                borderRadius: '8px',
                pointerEvents: 'none'
            }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
                    3D Influence Graph
                </h1>
                <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem' }}>
                    Interactive Network Visualization
                </p>
            </div>

            {/* Connection Legend */}
            {connectionLegend.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '110px',
                    left: '20px',
                    color: 'white',
                    background: 'rgba(0,0,0,0.7)',
                    padding: '15px',
                    borderRadius: '8px',
                    pointerEvents: 'none',
                    maxWidth: '250px'
                }}>
                    <h3 style={{
                        margin: '0 0 10px 0',
                        fontSize: '1rem',
                        fontWeight: 600,
                        borderBottom: '1px solid rgba(255,255,255,0.2)',
                        paddingBottom: '8px'
                    }}>
                        Connection Types
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {connectionLegend.map((entry, idx) => (
                            <div
                                key={idx}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontSize: '0.85rem'
                                }}
                            >
                                <div style={{
                                    width: '20px',
                                    height: '3px',
                                    backgroundColor: entry.color,
                                    borderRadius: '2px',
                                    flexShrink: 0
                                }} />
                                <span style={{ flex: 1 }}>{entry.type}</span>
                                <span style={{
                                    opacity: 0.7,
                                    fontSize: '0.75rem',
                                    fontWeight: 500
                                }}>
                                    ({entry.count})
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selectedNode && (
                <div className="modal-overlay">
                    <button
                        className="close-btn"
                        onClick={() => setSelectedNode(null)}
                    >
                        ×
                    </button>

                    <div className="modal-content">
                        {selectedNode.img && (
                            <img src={selectedNode.img} alt={selectedNode.name} />
                        )}

                        <h2>{selectedNode.name}</h2>

                        <span
                            className="group-badge"
                            style={{
                                color: GROUP_COLORS[selectedNode.group_type] || '#fff',
                                border: `1px solid ${GROUP_COLORS[selectedNode.group_type] || '#fff'}`
                            }}
                        >
                            {selectedNode.group_type?.toUpperCase()}
                        </span>

                        {selectedNode.description && (
                            <p>{selectedNode.description}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
